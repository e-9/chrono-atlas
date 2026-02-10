"""Fictional future-event generator with a curated fallback pool.

When Wikipedia returns few or no events for a date, this module supplies
fun, positive fictional events set between 2030 and 2200.
"""
from __future__ import annotations

import datetime
import random
import uuid
from typing import Any

import structlog

from src.models.event import EventSource, GeoLocation, HistoricalEvent

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Curated pool of 60+ fictional future events (diverse across all 12 months)
# ---------------------------------------------------------------------------

_FictionalEntry = dict[str, Any]

FICTIONAL_POOL: list[_FictionalEntry] = [
    # ── January ───────────────────────────────────────────────────────────
    {"month": 1, "day": 1, "year": 2045, "title": "Global Reforestation Day inaugurated",
     "description": "The first Global Reforestation Day sees one billion trees planted in 24 hours across six continents.",
     "location": {"place_name": "Nairobi, Kenya", "coordinates": (36.8219, -1.2921)},
     "categories": ["environmental", "cultural"]},
    {"month": 1, "day": 8, "year": 2067, "title": "Undersea research city opens in Mariana Trench",
     "description": "Abyssia, the first permanent deep-sea habitat, welcomes its founding 200 residents.",
     "location": {"place_name": "Mariana Trench, Pacific Ocean", "coordinates": (142.1996, 11.3493)},
     "categories": ["scientific", "exploration"]},
    {"month": 1, "day": 15, "year": 2051, "title": "AI-composed symphony premieres at Vienna State Opera",
     "description": "An orchestra performs the first fully AI-composed symphony to a sold-out crowd in Vienna.",
     "location": {"place_name": "Vienna, Austria", "coordinates": (16.3738, 48.2082)},
     "categories": ["cultural", "scientific"]},
    {"month": 1, "day": 22, "year": 2088, "title": "First solar-sail cargo vessel reaches Mars orbit",
     "description": "The cargo ship Helios Dawn arrives at Mars using only solar radiation pressure for propulsion.",
     "location": {"place_name": "Cape Canaveral, Florida", "coordinates": (-80.6041, 28.3922)},
     "categories": ["scientific", "exploration"]},
    {"month": 1, "day": 28, "year": 2110, "title": "World's last coal power plant decommissioned",
     "description": "The final remaining coal-fired power station is peacefully retired in a global celebration.",
     "location": {"place_name": "Kolkata, India", "coordinates": (88.3639, 22.5726)},
     "categories": ["environmental", "economic"]},
    # ── February ──────────────────────────────────────────────────────────
    {"month": 2, "day": 2, "year": 2039, "title": "Vertical farm feeds one million in Singapore",
     "description": "A 60-story vertical farm achieves full operational capacity, supplying fresh produce year-round.",
     "location": {"place_name": "Singapore", "coordinates": (103.8198, 1.3521)},
     "categories": ["scientific", "economic"]},
    {"month": 2, "day": 10, "year": 2072, "title": "Polar bear population surpasses 50,000",
     "description": "Arctic conservation efforts pay off as the polar bear population reaches a 100-year high.",
     "location": {"place_name": "Svalbard, Norway", "coordinates": (15.6356, 78.2232)},
     "categories": ["environmental"]},
    {"month": 2, "day": 14, "year": 2055, "title": "First interspecies translation device demonstrated",
     "description": "Researchers unveil a device that translates dolphin vocalizations into human language.",
     "location": {"place_name": "Monterey, California", "coordinates": (-121.8947, 36.6002)},
     "categories": ["scientific"]},
    {"month": 2, "day": 20, "year": 2098, "title": "Floating city inaugurated in Maldives",
     "description": "Maldives City Float, a self-sustaining community for 10,000, opens on the Indian Ocean.",
     "location": {"place_name": "Malé, Maldives", "coordinates": (73.5093, 4.1755)},
     "categories": ["cultural", "environmental"]},
    {"month": 2, "day": 27, "year": 2130, "title": "Universal language elective offered worldwide",
     "description": "A new constructed language designed for clarity becomes an optional school subject in 140 countries.",
     "location": {"place_name": "Geneva, Switzerland", "coordinates": (6.1432, 46.2044)},
     "categories": ["cultural"]},
    # ── March ─────────────────────────────────────────────────────────────
    {"month": 3, "day": 3, "year": 2041, "title": "Great Barrier Reef declared fully recovered",
     "description": "Marine scientists confirm 98 % coral cover after two decades of restoration.",
     "location": {"place_name": "Cairns, Australia", "coordinates": (145.7781, -16.9186)},
     "categories": ["environmental", "scientific"]},
    {"month": 3, "day": 9, "year": 2063, "title": "First zero-waste Olympic Games held",
     "description": "Barcelona hosts the Olympics with zero landfill waste and net-positive energy output.",
     "location": {"place_name": "Barcelona, Spain", "coordinates": (2.1734, 41.3851)},
     "categories": ["cultural", "environmental"]},
    {"month": 3, "day": 15, "year": 2077, "title": "Quantum internet goes live across Europe",
     "description": "A continent-wide quantum network enables unhackable communication for 500 million users.",
     "location": {"place_name": "Amsterdam, Netherlands", "coordinates": (4.9041, 52.3676)},
     "categories": ["scientific"]},
    {"month": 3, "day": 21, "year": 2035, "title": "World's first fusion power plant begins operation",
     "description": "ITER-Next delivers net-positive fusion energy to the French national grid for the first time.",
     "location": {"place_name": "Marseille, France", "coordinates": (5.3698, 43.2965)},
     "categories": ["scientific", "economic"]},
    {"month": 3, "day": 28, "year": 2150, "title": "Sahara Solar Belt reaches 1 terawatt capacity",
     "description": "The trans-Saharan solar array now generates enough clean power for all of Africa and southern Europe.",
     "location": {"place_name": "Ouarzazate, Morocco", "coordinates": (-6.9063, 30.9189)},
     "categories": ["environmental", "economic"]},
    # ── April ─────────────────────────────────────────────────────────────
    {"month": 4, "day": 1, "year": 2048, "title": "Robot comedian wins Edinburgh Fringe award",
     "description": "An AI stand-up act takes Best Newcomer at the Fringe, sparking joyful debate.",
     "location": {"place_name": "Edinburgh, Scotland", "coordinates": (-3.1883, 55.9533)},
     "categories": ["cultural", "scientific"]},
    {"month": 4, "day": 7, "year": 2060, "title": "Cherry blossom season extended by climate restoration",
     "description": "Tokyo's sakura bloom now lasts six weeks thanks to urban micro-climate management.",
     "location": {"place_name": "Tokyo, Japan", "coordinates": (139.6917, 35.6895)},
     "categories": ["environmental", "cultural"]},
    {"month": 4, "day": 12, "year": 2082, "title": "First baby born on the Moon",
     "description": "Luna Base Armstrong celebrates the first human birth beyond Earth.",
     "location": {"place_name": "Houston, Texas", "coordinates": (-95.3698, 29.7604)},
     "categories": ["scientific", "exploration"]},
    {"month": 4, "day": 19, "year": 2037, "title": "Amazon rainforest reaches net-zero deforestation",
     "description": "Brazil announces that regeneration now equals or exceeds any remaining forest loss.",
     "location": {"place_name": "Manaus, Brazil", "coordinates": (-60.0217, -3.1190)},
     "categories": ["environmental"]},
    {"month": 4, "day": 25, "year": 2105, "title": "World memory championship won by 112-year-old",
     "description": "Advances in longevity medicine let a centenarian claim the title in Kuala Lumpur.",
     "location": {"place_name": "Kuala Lumpur, Malaysia", "coordinates": (101.6869, 3.1390)},
     "categories": ["cultural", "scientific"]},
    # ── May ───────────────────────────────────────────────────────────────
    {"month": 5, "day": 4, "year": 2044, "title": "Hyperloop connects Los Angeles to San Francisco",
     "description": "Passengers travel coast-to-coast California in 35 minutes on the inaugural ride.",
     "location": {"place_name": "Los Angeles, California", "coordinates": (-118.2437, 34.0522)},
     "categories": ["scientific", "economic"]},
    {"month": 5, "day": 10, "year": 2058, "title": "Global literacy rate reaches 99 %",
     "description": "UNESCO certifies near-universal literacy, crediting AI tutoring programmes.",
     "location": {"place_name": "Paris, France", "coordinates": (2.3522, 48.8566)},
     "categories": ["cultural"]},
    {"month": 5, "day": 16, "year": 2091, "title": "Elephant population doubles in East Africa",
     "description": "Decades of anti-poaching drones and habitat corridors double the elephant census.",
     "location": {"place_name": "Amboseli, Kenya", "coordinates": (37.2531, -2.6527)},
     "categories": ["environmental"]},
    {"month": 5, "day": 22, "year": 2033, "title": "Lab-grown steak wins Michelin star in Tokyo",
     "description": "A cultured-meat tasting menu earns a star, marking a culinary milestone.",
     "location": {"place_name": "Tokyo, Japan", "coordinates": (139.6917, 35.6895)},
     "categories": ["cultural", "scientific"]},
    {"month": 5, "day": 30, "year": 2170, "title": "First interstellar probe data received from Proxima Centauri",
     "description": "After 130 years of travel, the Voyager III probe transmits images of Proxima Centauri b.",
     "location": {"place_name": "Canberra, Australia", "coordinates": (149.1300, -35.2809)},
     "categories": ["scientific", "exploration"]},
    # ── June ──────────────────────────────────────────────────────────────
    {"month": 6, "day": 1, "year": 2042, "title": "World's largest coral nursery opens in Fiji",
     "description": "A 500-hectare underwater nursery begins growing heat-resistant coral for reef restoration.",
     "location": {"place_name": "Suva, Fiji", "coordinates": (178.0650, -18.1416)},
     "categories": ["environmental", "scientific"]},
    {"month": 6, "day": 8, "year": 2065, "title": "Solar-powered aircraft completes non-stop global flight",
     "description": "The aircraft SunGlider lands in Abu Dhabi after 14 days of continuous solar-powered flight.",
     "location": {"place_name": "Abu Dhabi, UAE", "coordinates": (54.3773, 24.4539)},
     "categories": ["scientific", "exploration"]},
    {"month": 6, "day": 14, "year": 2053, "title": "Plastic-free ocean certification issued for Mediterranean",
     "description": "Independent auditors declare the Mediterranean Sea free of macro-plastic pollution.",
     "location": {"place_name": "Athens, Greece", "coordinates": (23.7275, 37.9838)},
     "categories": ["environmental"]},
    {"month": 6, "day": 21, "year": 2080, "title": "Longest summer solstice festival spans 48 time zones",
     "description": "A 48-hour rolling concert streams live music from every time zone on Earth.",
     "location": {"place_name": "Reykjavik, Iceland", "coordinates": (-21.8174, 64.1466)},
     "categories": ["cultural"]},
    {"month": 6, "day": 28, "year": 2038, "title": "First 3D-printed neighbourhood completed in Mexico City",
     "description": "Fifty affordable homes are printed in under a month using recycled concrete.",
     "location": {"place_name": "Mexico City, Mexico", "coordinates": (-99.1332, 19.4326)},
     "categories": ["economic", "scientific"]},
    # ── July ──────────────────────────────────────────────────────────────
    {"month": 7, "day": 4, "year": 2050, "title": "United States achieves 100 % renewable electricity",
     "description": "The national grid runs entirely on wind, solar, hydro, and geothermal for a full month.",
     "location": {"place_name": "Washington, D.C.", "coordinates": (-77.0369, 38.9072)},
     "categories": ["environmental", "economic"]},
    {"month": 7, "day": 10, "year": 2076, "title": "First human-AI co-authored novel wins Booker Prize",
     "description": "A collaborative novel by an author and her AI partner takes the prestigious literary award.",
     "location": {"place_name": "London, England", "coordinates": (-0.1276, 51.5074)},
     "categories": ["cultural", "scientific"]},
    {"month": 7, "day": 16, "year": 2062, "title": "Free public transport adopted across Scandinavia",
     "description": "Sweden, Norway, Denmark, and Finland eliminate all fares for buses, trams, and trains.",
     "location": {"place_name": "Stockholm, Sweden", "coordinates": (18.0686, 59.3293)},
     "categories": ["economic", "cultural"]},
    {"month": 7, "day": 22, "year": 2095, "title": "Global average temperature stabilises at pre-industrial +1.5 °C",
     "description": "Climate models confirm sustained stabilisation after 60 years of emissions reduction.",
     "location": {"place_name": "Zurich, Switzerland", "coordinates": (8.5417, 47.3769)},
     "categories": ["environmental", "scientific"]},
    {"month": 7, "day": 29, "year": 2140, "title": "Space elevator operational in Quito",
     "description": "The first commercial space elevator begins transporting passengers from the equator to orbit.",
     "location": {"place_name": "Quito, Ecuador", "coordinates": (-78.4678, -0.1807)},
     "categories": ["scientific", "exploration"]},
    # ── August ────────────────────────────────────────────────────────────
    {"month": 8, "day": 3, "year": 2046, "title": "World's largest urban food forest opens in Detroit",
     "description": "A 200-acre food forest provides free fruit and vegetables to 50,000 residents.",
     "location": {"place_name": "Detroit, Michigan", "coordinates": (-83.0458, 42.3314)},
     "categories": ["environmental", "cultural"]},
    {"month": 8, "day": 9, "year": 2070, "title": "Antarctic ice sheet shows net growth for first time in a century",
     "description": "Satellite data confirms the East Antarctic ice sheet gained mass over the past year.",
     "location": {"place_name": "McMurdo Station, Antarctica", "coordinates": (166.6667, -77.8500)},
     "categories": ["environmental", "scientific"]},
    {"month": 8, "day": 15, "year": 2054, "title": "Self-healing road surface deployed across Japan",
     "description": "Bio-engineered asphalt that repairs its own cracks is rolled out on all major highways.",
     "location": {"place_name": "Osaka, Japan", "coordinates": (135.5023, 34.6937)},
     "categories": ["scientific", "economic"]},
    {"month": 8, "day": 21, "year": 2036, "title": "First African-built satellite constellation goes live",
     "description": "The Uhuru constellation provides high-speed internet to every village on the continent.",
     "location": {"place_name": "Lagos, Nigeria", "coordinates": (3.3792, 6.5244)},
     "categories": ["scientific", "economic"]},
    {"month": 8, "day": 28, "year": 2180, "title": "Voyager IV enters Alpha Centauri system",
     "description": "The deep-space probe sends back the first close-up images of a neighbouring star system.",
     "location": {"place_name": "Pasadena, California", "coordinates": (-118.1445, 34.1478)},
     "categories": ["scientific", "exploration"]},
    # ── September ─────────────────────────────────────────────────────────
    {"month": 9, "day": 5, "year": 2043, "title": "World's first carbon-negative city certified",
     "description": "Copenhagen absorbs more CO₂ than it emits, earning UN carbon-negative status.",
     "location": {"place_name": "Copenhagen, Denmark", "coordinates": (12.5683, 55.6761)},
     "categories": ["environmental", "economic"]},
    {"month": 9, "day": 11, "year": 2059, "title": "Artificial photosynthesis powers a village in Rwanda",
     "description": "Leaf-mimicking panels convert sunlight and CO₂ into fuel for an off-grid community.",
     "location": {"place_name": "Kigali, Rwanda", "coordinates": (29.8739, -1.9403)},
     "categories": ["scientific", "environmental"]},
    {"month": 9, "day": 17, "year": 2085, "title": "First wheelchair marathon on the Moon",
     "description": "Adaptive athletes complete a 10 km race inside a pressurised lunar dome.",
     "location": {"place_name": "Houston, Texas", "coordinates": (-95.3698, 29.7604)},
     "categories": ["cultural", "exploration"]},
    {"month": 9, "day": 23, "year": 2031, "title": "Autonomous drone fleet plants 10 million mangroves",
     "description": "AI-guided drones complete the world's largest single-day coastal restoration effort.",
     "location": {"place_name": "Mumbai, India", "coordinates": (72.8777, 19.0760)},
     "categories": ["environmental", "scientific"]},
    {"month": 9, "day": 29, "year": 2160, "title": "Human lifespan average crosses 120 years",
     "description": "Global health data confirms average life expectancy has passed the 120-year mark.",
     "location": {"place_name": "Tokyo, Japan", "coordinates": (139.6917, 35.6895)},
     "categories": ["scientific"]},
    # ── October ───────────────────────────────────────────────────────────
    {"month": 10, "day": 2, "year": 2047, "title": "World's first tidal-powered desalination plant opens",
     "description": "The plant uses tidal energy to produce 100 million litres of fresh water daily.",
     "location": {"place_name": "Cape Town, South Africa", "coordinates": (18.4241, -33.9249)},
     "categories": ["scientific", "environmental"]},
    {"month": 10, "day": 8, "year": 2068, "title": "Holographic classroom adopted by 10,000 schools",
     "description": "Students learn history by walking through immersive holographic recreations of ancient cities.",
     "location": {"place_name": "Seoul, South Korea", "coordinates": (126.9780, 37.5665)},
     "categories": ["cultural", "scientific"]},
    {"month": 10, "day": 14, "year": 2056, "title": "Trans-Saharan railway completed",
     "description": "A solar-powered railway connects Lagos to Algiers in under 18 hours.",
     "location": {"place_name": "Algiers, Algeria", "coordinates": (3.0588, 36.7538)},
     "categories": ["economic", "exploration"]},
    {"month": 10, "day": 20, "year": 2034, "title": "First edible packaging mandated in the EU",
     "description": "All single-use food packaging in the EU must now be edible or fully compostable.",
     "location": {"place_name": "Brussels, Belgium", "coordinates": (4.3517, 50.8503)},
     "categories": ["environmental", "economic"]},
    {"month": 10, "day": 27, "year": 2120, "title": "Bermuda Triangle mystery solved by ocean AI",
     "description": "An autonomous underwater research fleet discovers unusual methane seep patterns explaining ship disappearances.",
     "location": {"place_name": "Nassau, Bahamas", "coordinates": (-77.3963, 25.0343)},
     "categories": ["scientific", "exploration"]},
    # ── November ──────────────────────────────────────────────────────────
    {"month": 11, "day": 3, "year": 2040, "title": "World's largest wildlife corridor opens in South America",
     "description": "A 5,000 km protected corridor connects Patagonia to the Amazon for migratory species.",
     "location": {"place_name": "Buenos Aires, Argentina", "coordinates": (-58.3816, -34.6037)},
     "categories": ["environmental"]},
    {"month": 11, "day": 9, "year": 2074, "title": "AI referee officiates FIFA World Cup final",
     "description": "The first fully automated referee system runs a flawless World Cup final in Riyadh.",
     "location": {"place_name": "Riyadh, Saudi Arabia", "coordinates": (46.6753, 24.7136)},
     "categories": ["cultural", "scientific"]},
    {"month": 11, "day": 15, "year": 2057, "title": "Gravity-wave observatory detects alien signal",
     "description": "A structured repeating pattern in gravitational waves sparks worldwide excitement.",
     "location": {"place_name": "Pisa, Italy", "coordinates": (10.4017, 43.7228)},
     "categories": ["scientific", "exploration"]},
    {"month": 11, "day": 21, "year": 2032, "title": "Free community kitchens reach every continent",
     "description": "The global network of volunteer-run kitchens now serves meals in all 195 countries.",
     "location": {"place_name": "São Paulo, Brazil", "coordinates": (-46.6333, -23.5505)},
     "categories": ["cultural", "economic"]},
    {"month": 11, "day": 27, "year": 2190, "title": "First city on Mars reaches 100,000 residents",
     "description": "Nova Olympia celebrates its 100,000th inhabitant with a Martian harvest festival.",
     "location": {"place_name": "Cape Canaveral, Florida", "coordinates": (-80.6041, 28.3922)},
     "categories": ["exploration", "cultural"]},
    # ── December ──────────────────────────────────────────────────────────
    {"month": 12, "day": 1, "year": 2049, "title": "World Peace Index hits all-time high",
     "description": "The annual Global Peace Index records the lowest level of conflict since tracking began.",
     "location": {"place_name": "Oslo, Norway", "coordinates": (10.7522, 59.9139)},
     "categories": ["political", "cultural"]},
    {"month": 12, "day": 7, "year": 2066, "title": "Great Pacific Garbage Patch fully cleared",
     "description": "Autonomous collection vessels remove the last remnants of the oceanic plastic patch.",
     "location": {"place_name": "Honolulu, Hawaii", "coordinates": (-157.8583, 21.3069)},
     "categories": ["environmental"]},
    {"month": 12, "day": 13, "year": 2083, "title": "Universal basic income adopted by 100 nations",
     "description": "Automation dividends fund a basic income that lifts 800 million people out of poverty.",
     "location": {"place_name": "New York City, USA", "coordinates": (-74.0060, 40.7128)},
     "categories": ["economic", "political"]},
    {"month": 12, "day": 20, "year": 2030, "title": "Northern white rhino population recovered via cloning",
     "description": "The first herd of 30 cloned northern white rhinos is released into a Kenyan sanctuary.",
     "location": {"place_name": "Ol Pejeta, Kenya", "coordinates": (36.9068, 0.0236)},
     "categories": ["environmental", "scientific"]},
    {"month": 12, "day": 25, "year": 2200, "title": "Galactic Heritage Museum opens on lunar south pole",
     "description": "A museum preserving Earth's cultural treasures opens in a permanently shadowed crater.",
     "location": {"place_name": "Cape Canaveral, Florida", "coordinates": (-80.6041, 28.3922)},
     "categories": ["cultural", "exploration"]},
    {"month": 12, "day": 31, "year": 2100, "title": "Countdown to 22nd century celebrated worldwide",
     "description": "Billions gather to welcome the new century with synchronised light shows on every continent.",
     "location": {"place_name": "Sydney, Australia", "coordinates": (151.2093, -33.8688)},
     "categories": ["cultural"]},
]

assert len(FICTIONAL_POOL) >= 60, f"Pool has only {len(FICTIONAL_POOL)} entries; need 60+"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_fictional_events(month: int, day: int, count: int = 3) -> list[HistoricalEvent]:
    """Return *count* fictional future events for the given month/day.

    Strategy:
    1. Collect exact month/day matches from the curated pool.
    2. If not enough, add same-month events.
    3. If still not enough, fill with random picks from the entire pool.
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Exact date matches
    exact = [e for e in FICTIONAL_POOL if e["month"] == month and e["day"] == day]
    # Same-month matches (excluding exact)
    same_month = [e for e in FICTIONAL_POOL if e["month"] == month and e["day"] != day]

    candidates: list[_FictionalEntry] = []
    candidates.extend(exact)

    if len(candidates) < count:
        random.shuffle(same_month)
        candidates.extend(same_month[: count - len(candidates)])

    if len(candidates) < count:
        remaining = [e for e in FICTIONAL_POOL if e not in candidates]
        random.shuffle(remaining)
        candidates.extend(remaining[: count - len(candidates)])

    # Trim to requested count (exact matches could exceed count)
    selected = candidates[:count]

    iso_date = f"{month:02d}-{day:02d}"
    events: list[HistoricalEvent] = []
    for entry in selected:
        events.append(
            HistoricalEvent(
                id=str(uuid.uuid4()),
                iso_date=iso_date,
                source=EventSource(
                    type="ai_generated",
                    generated_at=now_iso,
                    model_version="curated-pool-v1",
                    plausibility_score=0.7,
                ),
                title=entry["title"],
                description=entry["description"],
                year=entry["year"],
                categories=entry["categories"],
                location=GeoLocation(
                    coordinates=entry["location"]["coordinates"],
                    confidence="estimated",
                    geocoder="curated",
                    place_name=entry["location"]["place_name"],
                ),
                created_at=now_iso,
            )
        )

    logger.info(
        "fictional_events_generated",
        month=month,
        day=day,
        requested=count,
        returned=len(events),
    )
    return events


# ---------------------------------------------------------------------------
# AI stub — will be replaced with Azure AI Foundry GPT-4o
# ---------------------------------------------------------------------------

# TODO: Replace with Azure AI Foundry GPT-4o
async def generate_with_ai(month: int, day: int, count: int = 3) -> list[HistoricalEvent] | None:
    """Generate fictional events using a large language model.

    Currently returns ``None`` (stub).  A future implementation will call
    Azure AI Foundry GPT-4o to produce creative, plausible future events.
    """
    return None
