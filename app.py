# app.py — backend only (keeps your existing index.html)
# Run:  GOOGLE_MAPS_SERVER_KEY=your_key GOOGLE_MAPS_JS_KEY=your_browser_key python app.py
# URL:  http://127.0.0.1:5000

from dotenv import load_dotenv
load_dotenv()


import os, re, math, time, datetime, random
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse, parse_qs, unquote
from functools import lru_cache

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from flask import Flask, request, jsonify, render_template, abort
from werkzeug.middleware.proxy_fix import ProxyFix
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

# -------------------------------------------------------------------
# Config / Keys
# -------------------------------------------------------------------
GOOGLE_SERVER_KEY  = os.getenv("GOOGLE_MAPS_SERVER_KEY")
GOOGLE_BROWSER_KEY = os.getenv("GOOGLE_MAPS_JS_KEY", GOOGLE_SERVER_KEY)
if not GOOGLE_SERVER_KEY:
    raise RuntimeError("GOOGLE_MAPS_SERVER_KEY is required")

PORT = int(os.getenv("PORT", "5000"))

# Tunables
DM_CHUNK = 25                       # DistanceMatrix origins/destinations chunk (up to 100 elements per call)
FALLBACK_SPEED_KMH_DEFAULT = 28.0   # fallback ETA speed if API misses pairs
REQUEST_TIMEOUT = 15
RETRY_TOTAL = 3
RETRY_BACKOFF = 0.6

# Sensible bounds for vehicle speed (respecting typical legal limits)
MAX_SPEED_CAP_KMH = 120.0
MIN_SPEED_CAP_KMH = 15.0
V_REF_KMH_DEFAULT  = 60.0           # default ref speed for hybrid objective

# Tiny bias to prefer fewer buses on ties (seconds-equivalent penalty per bus)
BUS_PENALTY_EQUIV_SEC = 60.0

# Safety limits
MAX_STUDENTS = 500
MAX_CONTENT_LENGTH = 2_000_000  # ~2MB

# -------------------------------------------------------------------
# App / HTTP session with retries
# -------------------------------------------------------------------
app = Flask(
    __name__,
    static_folder='static',          # folder where CSS/JS/images are
    static_url_path='/static',       # URL prefix for static files
    template_folder='templates'      # folder containing HTML pages
)

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

def make_session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=RETRY_TOTAL,
        backoff_factor=RETRY_BACKOFF,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["HEAD", "GET", "OPTIONS"])
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=50)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    s.headers.update({
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
        "Accept-Language": "en-US,en;q=0.9"
    })
    return s

SESSION = make_session()

# -------------------------------------------------------------------
# Utilities
# -------------------------------------------------------------------
def _clamp_float(v, lo, hi, default):
    try:
        x = float(v)
        if math.isnan(x) or math.isinf(x):
            return default
        return min(max(x, lo), hi)
    except Exception:
        return default

def _as_pos_int(v, default, lo=1, hi=10_000):
    try:
        x = int(v)
        return min(max(x, lo), hi)
    except Exception:
        return default

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return int(round(2 * R * math.asin(math.sqrt(a)) * 1000))

def chunk(seq, n):
    for i in range(0, len(seq), n):
        yield i, seq[i:i+n]

def _dist2(a, b): return (a[0]-b[0])**2 + (a[1]-b[1])**2
def _mean(points):
    if not points: return (0.0, 0.0)
    return (sum(p[0] for p in points)/len(points), sum(p[1] for p in points)/len(points))

def kmeans_coords(coords, k: int, iters: int = 12):
    n = len(coords)
    if k <= 1 or n == 0: return [0]*n
    k = min(k, n)
    # shuffle to reduce first-centroid bias
    coords_shuffled = coords[:]
    random.Random(42).shuffle(coords_shuffled)
    # k-means++ seeding
    centroids = [coords_shuffled[0]]
    for _ in range(1, k):
        best_idx, best_d = 0, -1.0
        for i, p in enumerate(coords_shuffled):
            dmin = min(_dist2(p, c) for c in centroids)
            if dmin > best_d: best_d, best_idx = dmin, i
        centroids.append(coords_shuffled[best_idx])
    labels = [0]*n
    for _ in range(iters):
        for i, p in enumerate(coords):
            labels[i] = min(range(k), key=lambda c: _dist2(p, centroids[c]))
        for c in range(k):
            pts = [coords[i] for i in range(n) if labels[i] == c]
            if pts: centroids[c] = _mean(pts)
    return labels

def capacity_cluster(students: List[Dict[str, Any]], bus_count: int, bus_capacity: int) -> List[List[int]]:
    n = len(students)
    if n == 0: return [[] for _ in range(bus_count)]
    if n > bus_count * bus_capacity:
        raise ValueError(f"Too many students ({n}) for {bus_count} buses with {bus_capacity} seats each")

    coords = [(s["lat"], s["lng"]) for s in students]
    labels = kmeans_coords(coords, max(1, bus_count))
    bins = [[] for _ in range(bus_count)]
    for i, lab in enumerate(labels):
        bins[min(lab, bus_count-1)].append(i)

    overflow = []
    filled = [[] for _ in range(bus_count)]
    for b, idxs in enumerate(bins):
        if len(idxs) <= bus_capacity:
            filled[b] = idxs[:]
        else:
            filled[b] = idxs[:bus_capacity]
            overflow.extend(idxs[bus_capacity:])

    for idx in overflow:
        tgt = min(range(bus_count), key=lambda b: len(filled[b]))
        if len(filled[tgt]) < bus_capacity:
            filled[tgt].append(idx)
    return filled

# -------------------------------------------------------------------
# Robust Google Maps link resolver (cached)
# -------------------------------------------------------------------
COORD_PATTERNS = [
    re.compile(r'/maps/(?:search|place|dir)/(-?\d+(?:\.\d+)?)[,\s\+%2C]+(-?\d+(?:\.\d+)?)(?:[/\?]|$)', re.I),
    re.compile(r'[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', re.I),
    re.compile(r'@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[,/]|$)'),
    re.compile(r'[?&](?:q|query)=(-?\d+(?:\.\d+)?)[,\s\+]+(-?\d+(?:\.\d+)?)'),
    re.compile(r'[?&](?:daddr|saddr|origin|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)'),
    re.compile(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)'),
]
PLACE_ID_PATTERNS = [
    re.compile(r'place_id:([A-Za-z0-9_-]{20,})'),
    re.compile(r'[?&]query_place_id=([A-Za-z0-9_-]{20,})'),
    re.compile(r'[?&]q=place_id:([A-Za-z0-9_-]{20,})')
]

def _coords_from_text(url: str) -> Optional[Tuple[float, float]]:
    u = unquote(url)
    parsed = urlparse(u); q = parse_qs(parsed.query)
    if "link" in q:
        inner = unquote(q["link"][0])
        c = _coords_from_text(inner)
        if c: return c
        u = inner
    for pat in COORD_PATTERNS:
        m = pat.search(u)
        if m:
            try:
                return float(m.group(1)), float(m.group(2))
            except Exception:
                continue
    return None

def _place_id_from_text(url: str) -> Optional[str]:
    for pat in PLACE_ID_PATTERNS:
        m = pat.search(url)
        if m: return m.group(1)
    return None

def _text_query_from_url(url: str) -> Optional[str]:
    parsed = urlparse(url); q = parse_qs(parsed.query)
    for key in ("q", "query"):
        if key in q:
            val = unquote(q[key][0])
            if re.match(r'^\s*-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?\s*$', val):  # pure coords
                return None
            if val.startswith("place_id:"):
                return None
            return val
    return None

def _extract_maps_url_from_html(html: str) -> Optional[str]:
    m = re.search(r'<meta[^>]+http-equiv=["\']refresh["\'][^>]+content=["\'][^;]+;url=([^"\']+)', html, flags=re.I)
    if m: return unquote(m.group(1))
    m = re.search(r'location(?:\.href)?\s*=\s*["\']([^"\']+)["\']', html)
    if m: return unquote(m.group(1))
    m = re.search(r'location\.replace\(["\']([^"\']+)["\']\)', html)
    if m: return unquote(m.group(1))
    m = re.search(r'(https://(?:www\.)?google\.[^"\']*/maps[^"\']+)', html)
    if m: return unquote(m.group(1))
    m = re.search(r'https:\\/\\/www\.google\.[^"\'\\]+\\/maps[^"\'\\]+', html)
    if m:
        esc = m.group(0)
        return esc.encode('utf-8').decode('unicode_escape').replace('\\/', '/')
    return None

@lru_cache(maxsize=2048)
def expand_url_cached(url: str) -> Optional[str]:
    try:
        h = SESSION.head(url, allow_redirects=True, timeout=REQUEST_TIMEOUT)
        final_u = h.url
        if final_u and "google.com/maps" in final_u:
            return final_u
        r = SESSION.get(url, allow_redirects=True, timeout=REQUEST_TIMEOUT)
        final_u = r.url or url
        if "google.com/maps" in final_u:
            return final_u
        if r.text:
            embedded = _extract_maps_url_from_html(r.text)
            if embedded: return embedded
        return final_u
    except Exception:
        return None

@lru_cache(maxsize=4096)
def geocode_text_cached(q: str) -> Optional[Tuple[float, float]]:
    try:
        resp = SESSION.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": q, "key": GOOGLE_SERVER_KEY},
            timeout=REQUEST_TIMEOUT
        ).json()
        if resp.get("status") == "OK" and resp.get("results"):
            loc = resp["results"][0]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
    except Exception:
        pass
    return None

@lru_cache(maxsize=4096)
def place_details_latlng_cached(place_id: str) -> Optional[Tuple[float, float]]:
    try:
        pr = SESSION.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params={"place_id": place_id, "fields": "geometry", "key": GOOGLE_SERVER_KEY},
            timeout=REQUEST_TIMEOUT
        ).json()
        if pr.get("status") == "OK" and pr.get("result") and "geometry" in pr["result"]:
            loc = pr["result"]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
    except Exception:
        pass
    return None

@lru_cache(maxsize=2048)
def find_place_from_text_cached(q: str) -> Optional[Tuple[float, float]]:
    try:
        fp = SESSION.get(
            "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
            params={"input": q, "inputtype": "textquery", "fields": "geometry", "key": GOOGLE_SERVER_KEY},
            timeout=REQUEST_TIMEOUT
        ).json()
        if fp.get("status") == "OK" and fp.get("candidates"):
            loc = fp["candidates"][0]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
    except Exception:
        pass
    return None

@lru_cache(maxsize=4096)
def resolve_maps_link(link: str) -> Optional[Tuple[float, float]]:
    if not link:
        return None
    c = _coords_from_text(link)
    if c: return c
    long_url = expand_url_cached(link) or link
    c = _coords_from_text(long_url)
    if c: return c
    pid = _place_id_from_text(long_url)
    if pid:
        c = place_details_latlng_cached(pid)
        if c: return c
    tq = _text_query_from_url(long_url)
    if tq:
        c = geocode_text_cached(tq)
        if c: return c
    return find_place_from_text_cached(link)

# -------------------------------------------------------------------
# Distance Matrix (traffic-aware, cached & with fallbacks)
# -------------------------------------------------------------------
def _default_departure_epoch() -> int:
    # 07:30 local server time today → epoch seconds
    now = datetime.datetime.now()
    dt = datetime.datetime.combine(now.date(), datetime.time(7, 30))
    return int(dt.timestamp())

def _dep_to_epoch_or_now(iso: Optional[str]) -> Any:
    if not iso:
        return _default_departure_epoch()
    try:
        # Accept 'YYYY-MM-DDTHH:MM[:SS][+TZ]' or naive; bucket to 15 min
        dt = datetime.datetime.fromisoformat(iso)
        bucket = int(dt.timestamp() // (15*60) * (15*60))
        return bucket
    except Exception:
        return "now"

def _matrix_cache_key(points: List[Dict[str, Any]], dep: Any, fb_speed_kmh: float) -> Tuple:
    coords = tuple((round(p["lat"], 6), round(p["lng"], 6)) for p in points)
    # Include a coarse bucket of fallback speed to avoid cache poisoning when API misses pairs
    fb_bucket = int(round(float(fb_speed_kmh) / 5.0) * 5)
    return (coords, dep, fb_bucket)

@lru_cache(maxsize=256)
def _distance_matrix_cached(key: Tuple, fallback_speed_kmh: float) -> Tuple[List[List[int]], List[List[int]], int]:
    coords, dep, _fb_bucket = key
    n = len(coords)
    dist = [[0]*n for _ in range(n)]
    dur  = [[0]*n for _ in range(n)]

    origins = [f"{lat},{lng}" for (lat, lng) in coords]
    destinations = origins[:]
    dep_param = dep

    for oi, o_chunk in chunk(origins, DM_CHUNK):
        for dj, d_chunk in chunk(destinations, DM_CHUNK):
            try:
                r = SESSION.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params={
                        "origins": "|".join(o_chunk),
                        "destinations": "|".join(d_chunk),
                        "mode": "driving",
                        "departure_time": dep_param,
                        "traffic_model": "best_guess",
                        "key": GOOGLE_SERVER_KEY
                    },
                    timeout=REQUEST_TIMEOUT
                ).json()
            except Exception:
                r = {"status": "ERROR"}

            if r.get("status") != "OK":
                continue

            for rr, row in enumerate(r.get("rows", [])):
                for cc, cell in enumerate(row.get("elements", [])):
                    I = oi + rr
                    J = dj + cc
                    if I == J:
                        dist[I][J] = 0
                        dur[I][J]  = 0
                        continue
                    if cell.get("status") == "OK":
                        dist[I][J] = int(cell["distance"]["value"])
                        dur[I][J]  = int(cell.get("duration_in_traffic", cell["duration"])["value"])

    # Fallback fill for any missing pairs using haversine + provided fallback speed
    fallback_pairs = 0
    fallback_speed_mps = max(1e-6, fallback_speed_kmh * (1000.0 / 3600.0))
    for i in range(n):
        for j in range(i + 1, n):
            need_ij = dist[i][j] <= 0 or dur[i][j] <= 0
            need_ji = dist[j][i] <= 0 or dur[j][i] <= 0
            if not (need_ij or need_ji):
                continue

            (lat1, lon1) = coords[i]
            (lat2, lon2) = coords[j]
            d_m = haversine_m(lat1, lon1, lat2, lon2)
            eta = max(1, int(round(d_m / fallback_speed_mps)))

            if need_ij:
                if dist[i][j] <= 0:
                    dist[i][j] = d_m
                if dur[i][j] <= 0:
                    dur[i][j] = eta
                fallback_pairs += 1

            if need_ji:
                if dist[j][i] <= 0:
                    dist[j][i] = d_m
                if dur[j][i] <= 0:
                    dur[j][i] = eta
                fallback_pairs += 1

    return dist, dur, fallback_pairs

def google_distance_matrix_cached(points: List[Dict[str, Any]], departure_time: Optional[str], fallback_speed_kmh: float):
    dep = _dep_to_epoch_or_now(departure_time)
    key = _matrix_cache_key(points, dep, fallback_speed_kmh)
    return _distance_matrix_cached(key, fallback_speed_kmh)

# -------------------------------------------------------------------
# OR-Tools TSP (closed loop)
# -------------------------------------------------------------------
def solve_tsp_loop(cost_m: List[List[int]]):
    n = len(cost_m)
    if n <= 1:
        return [0], 0
    manager = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def cb(fi, ti):
        i = manager.IndexToNode(fi); j = manager.IndexToNode(ti)
        return int(cost_m[i][j])

    cb_id = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(cb_id)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.seconds = 8

    sol = routing.SolveWithParameters(params)
    if sol is None:
        raise RuntimeError("No route found.")

    order = []
    idx = routing.Start(0)
    total = 0
    while not routing.IsEnd(idx):
        order.append(manager.IndexToNode(idx))
        nxt = sol.Value(routing.NextVar(idx))
        total += routing.GetArcCostForVehicle(idx, nxt, 0)
        idx = nxt
    order.append(0)
    return order, total

# -------------------------------------------------------------------
# Build routes for a given clustering (objective: "duration", "distance", "hybrid")
# -------------------------------------------------------------------
def build_routes_for_clusters(
    clusters: List[List[int]],
    all_points: List[Dict[str, Any]],
    distM: List[List[int]],
    durM: List[List[int]],
    bus_capacity: int,
    objective: str = "duration",
    weight_duration: float = 0.7,      # used only when objective == "hybrid"
    v_ref_kmh: float = V_REF_KMH_DEFAULT,
    fuel_L_per_100km: float = 6.0
):
    routes = []
    total_cost = 0  # seconds (duration/hybrid) or meters (distance)
    total_fuel_L = 0.0

    v_ref_mps = max(1e-6, v_ref_kmh * 1000.0 / 3600.0)

    def hybrid_cost_matrix(subDist, subDur, w: float):
        n = len(subDist)
        cost = [[0]*n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    cost[i][j] = 0
                else:
                    dist_sec = subDist[i][j] / v_ref_mps
                    cost[i][j] = int(round(w * subDur[i][j] + (1.0 - w) * dist_sec))
        return cost

    for cid, cl in enumerate(clusters, start=1):
        if not cl:
            continue

        gidx = [0] + [i+1 for i in cl]  # map cluster indices to global indices
        subDist = [[distM[i][j] for j in gidx] for i in gidx]
        subDur  = [[durM[i][j]  for j in gidx] for i in gidx]

        # choose objective matrix
        if objective == "distance":
            cost_m = subDist
        elif objective == "hybrid":
            w = max(0.0, min(1.0, float(weight_duration)))
            cost_m = hybrid_cost_matrix(subDist, subDur, w)
        else:  # "duration" default
            cost_m = subDur

        order, tour_cost = solve_tsp_loop(cost_m)

        segs = range(len(order)-1)
        total_dur = sum(subDur[order[i]][order[i+1]] for i in segs)
        total_dis = sum(subDist[order[i]][order[i+1]] for i in segs)

        # fuel = distance_km * (L/100km)
        distance_km = total_dis / 1000.0
        fuel_L = distance_km * (fuel_L_per_100km / 100.0)

        stops = [{
            "name": all_points[gidx[k]].get("name", f"Stop {k}"),
            "lat":  all_points[gidx[k]]["lat"],
            "lng":  all_points[gidx[k]]["lng"]
        } for k in order]

        routes.append({
            "busId": cid,
            "stops": stops,
            "totalDistanceKm": round(distance_km, 2),
            "totalDurationMin": round(total_dur / 60.0, 1),
            "usedSeats": len(cl),
            "capacity": bus_capacity,
            "fuelLiters": round(fuel_L, 2),
            "objectiveCost": int(tour_cost)
        })

        total_fuel_L += fuel_L
        total_cost   += tour_cost

    return routes, total_cost, total_fuel_L

# -------------------------------------------------------------------
# Guards
# -------------------------------------------------------------------
@app.before_request
def _guard():
    # Basic content-length guard is handled by app.config["MAX_CONTENT_LENGTH"]
    pass

# -------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------
@app.get("/")
def index():
    return render_template("index.html", google_key=GOOGLE_BROWSER_KEY)

@app.get("/resolve")
def resolve_endpoint():
    link = request.args.get("url", "").strip()
    if not link:
        return jsonify({"error": "missing url"}), 400
    coords = resolve_maps_link(link)
    if not coords:
        return jsonify({"error": "coords not found"}), 404
    lat, lng = coords
    return jsonify({"lat": lat, "lng": lng})

@app.get("/dashboard.html")
def dashboard():
    return render_template("dashboard.html")


@app.get("/drivers.html")
def drivers_page():
    return render_template("drivers.html")


@app.get("/students.html")
def students_page():
    return render_template("students.html")


@app.get("/calculator.html")
def calculator_page():
    return render_template("calculator.html",
                           google_key=GOOGLE_BROWSER_KEY)

@app.get("/expand")
def expand_endpoint():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "missing url"}), 400
    long_u = expand_url_cached(url)
    if not long_u:
        return jsonify({"error": "expand failed"}), 400
    return jsonify({"url": long_u}), 200

@app.get("/health")
def health():
    return jsonify({"ok": True}), 200

@app.post("/optimize")
def optimize():
    data = request.get_json(force=True)

    if "school" not in data or "students" not in data:
        return jsonify({"error": "Provide 'school' and 'students'."}), 400

    # Input extraction + validation
    school         = data["school"]
    students       = data["students"][:MAX_STUDENTS+1]
    if len(students) > MAX_STUDENTS:
        return jsonify({"error": f"Too many students. Limit is {MAX_STUDENTS}."}), 400

    bus_count    = _as_pos_int(data.get("busCount", 1), 1, 1, 1000)
    bus_capacity = _as_pos_int(data.get("busCapacity", 10), 10, 1, 500)

    # Default departure time (07:30 local) if not provided
    user_departure_time = data.get("departureTime")
    if not user_departure_time or not isinstance(user_departure_time, str) or not user_departure_time.strip():
        departure_time = None  # we will compute default epoch
        defaulted_time = True
    else:
        departure_time = user_departure_time.strip()
        defaulted_time = False

    # Max speed (km/h) option (for hybrid normalization + fallback ETA)
    raw_speed = data.get("maxSpeedKmh", V_REF_KMH_DEFAULT)
    max_speed_kmh = _clamp_float(raw_speed, MIN_SPEED_CAP_KMH, MAX_SPEED_CAP_KMH, V_REF_KMH_DEFAULT)

    # Fallback ETA speed uses same bound
    fallback_speed_kmh = max(MIN_SPEED_CAP_KMH, min(max_speed_kmh, MAX_SPEED_CAP_KMH))
    if fallback_speed_kmh <= 0:
        fallback_speed_kmh = FALLBACK_SPEED_KMH_DEFAULT

    # Fuel consumption (L/100 km)
    fuel_L_per_100km = _clamp_float(data.get("fuelConsumptionLper100", 6.0), 0.1, 60.0, 6.0)

    # objective: "duration" (default), "distance", or "hybrid"
    objective = (data.get("objective") or "duration").lower()
    if objective not in ("duration", "distance", "hybrid"):
        objective = "duration"
    weight_duration = float(data.get("weightDuration", 0.7))

    # Early exit if no students
    if not students:
        summary = {
            "totalStudents": 0,
            "busesUsed": 0,
            "busCount": bus_count,
            "objective": objective,
            "defaultedDepartureTime": defaulted_time,
            "departureTime": (datetime.datetime.now()
                              if departure_time is None else departure_time),
            "maxSpeedKmh": max_speed_kmh,
            "fallbackSpeedKmh": fallback_speed_kmh,
            "fuelConsumptionLper100": fuel_L_per_100km,
            "avgDistanceKm": 0.0,
            "avgDurationMin": 0.0,
            "totalFuelLiters": 0.0
        }
        if objective == "hybrid":
            summary["weightDuration"] = weight_duration
        return jsonify({"summary": summary, "routes": [], "diagnostics": {
            "matrixPoints": 1,
            "fallbackPairs": 0
        }}), 200

    # Resolve pasted Google Maps links → coords
    for s in students:
        if isinstance(s.get("lat"), (int, float)) and isinstance(s.get("lng"), (int, float)):
            continue
        link = s.get("mapsLink") or s.get("address") or s.get("place") or s.get("url")
        if isinstance(link, str) and link.startswith(("http://", "https://")):
            coords = resolve_maps_link(link)
            if coords:
                s["lat"], s["lng"] = coords

    # Validate after resolution
    for s in students:
        if not isinstance(s.get("lat"), (int, float)) or not isinstance(s.get("lng"), (int, float)):
            name = s.get("name", "(no name)")
            return jsonify({"error": f"Missing coordinates for student '{name}'. "
                                     "Provide an address or a Google Maps link."}), 400

    school_name = school.get("name", "School")
    if not isinstance(school.get("lat"), (int, float)) or not isinstance(school.get("lng"), (int, float)):
        return jsonify({"error": "School must include numeric 'lat' and 'lng'."}), 400

    all_points = [{"name": school_name, "lat": school["lat"], "lng": school["lng"]}] + students

    # Traffic-aware matrix (uses duration_in_traffic) with safe fallbacks
    distM, durM, fallback_pairs = google_distance_matrix_cached(
        all_points, departure_time, fallback_speed_kmh
    )

    # === Try every bus count (bounded by useful maximum) and pick the best objective value ===
    best = {
        "routes": [],
        "clusters": None,
        "buses_used": 0,
        "total_cost": float("inf"),
        "total_fuel_L": 0.0
    }

    max_buses_to_try = min(bus_count, max(1, len(students)))
    stall_runs = 0
    STALL_LIMIT = 2

    for b in range(1, max_buses_to_try + 1):
        try:
            clusters_b = capacity_cluster(students, b, bus_capacity)
        except ValueError:
            continue

        routes_b, total_cost_b, total_fuel_b = build_routes_for_clusters(
            clusters_b, all_points, distM, durM, bus_capacity,
            objective=objective, weight_duration=weight_duration,
            v_ref_kmh=max_speed_kmh, fuel_L_per_100km=fuel_L_per_100km
        )

        # bias toward fewer buses when costs are close/equal
        total_cost_b_biased = total_cost_b + BUS_PENALTY_EQUIV_SEC * len(routes_b)

        if total_cost_b_biased < best["total_cost"]:
            best = {
                "routes": routes_b,
                "clusters": clusters_b,
                "buses_used": len(routes_b),
                "total_cost": total_cost_b_biased,
                "total_fuel_L": total_fuel_b
            }
            stall_runs = 0
        else:
            stall_runs += 1
            if stall_runs >= STALL_LIMIT and b >= max(1, best["buses_used"]):
                break

    routes = best["routes"]
    buses_used = best["buses_used"]
    total_fuel = best["total_fuel_L"]

    # Summaries
    avg_distance_km = round(sum(r["totalDistanceKm"] for r in routes)/buses_used, 2) if buses_used else 0.0
    avg_duration_min = round(sum(r["totalDurationMin"] for r in routes)/buses_used, 1) if buses_used else 0.0

    # Departure time used (epoch or "now")
    used_dep = _dep_to_epoch_or_now(departure_time)
    if used_dep == "now":
        # convert "now" to current epoch (for transparency in diagnostics)
        used_dep_epoch = int(time.time())
    else:
        used_dep_epoch = int(used_dep)

    summary = {
        "totalStudents": len(students),
        "busesUsed": buses_used,
        "busCount": bus_count,
        "objective": objective,
        "defaultedDepartureTime": defaulted_time or (departure_time is None),
        "departureTime": departure_time if departure_time else datetime.datetime.fromtimestamp(used_dep_epoch).isoformat(),
        "maxSpeedKmh": max_speed_kmh,
        "fallbackSpeedKmh": fallback_speed_kmh,
        "fuelConsumptionLper100": fuel_L_per_100km,
        "avgDistanceKm": avg_distance_km,
        "avgDurationMin": avg_duration_min,
        "totalFuelLiters": round(total_fuel, 2)
    }
    if objective == "hybrid":
        summary["weightDuration"] = float(weight_duration)

    diagnostics = {
        "matrixPoints": len(all_points),
        "usedDepartureEpoch": used_dep_epoch,
        "fallbackPairs": fallback_pairs,
    }

    return jsonify({"summary": summary, "routes": routes, "diagnostics": diagnostics}), 200

# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, debug=False)
