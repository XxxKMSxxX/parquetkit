# /// script
# requires-python = ">=3.11"
# dependencies = ["pyarrow>=17"]
# ///
"""ビューアの「Load a sample file」用デモParquetを生成する。

実行: uv run scripts/generate_sample.py
生成物は public/samples/demo.parquet にコミットする(再現手順としてこのスクリプトを保存)。

初見の訪問者が手元に.parquetを持っていなくても製品を体験できるようにするのが目的。
schema表示が映えるよう、logical typeが多様な現実的い注文データにしてある。
"""

import datetime
import random
from decimal import Decimal
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

OUT = Path(__file__).parent.parent / "public" / "samples"
OUT.mkdir(parents=True, exist_ok=True)

ROWS = 5_000
rng = random.Random(20260712)

COUNTRIES = ["US", "DE", "JP", "GB", "FR", "BR", "IN", "CA", "AU", "NL"]
STATUSES = ["delivered", "shipped", "processing", "returned", "cancelled"]
PRODUCTS = [
    "mechanical keyboard", "usb-c dock", "laptop stand", "webcam",
    "noise-cancelling headphones", "monitor arm", "ergonomic mouse",
    "desk mat", "hdmi cable", "portable ssd",
]

base_ts = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)

order_id = list(range(100_001, 100_001 + ROWS))
ordered_at = [
    base_ts + datetime.timedelta(minutes=rng.randint(0, 60 * 24 * 180))
    for _ in range(ROWS)
]
customer_id = [f"C-{rng.randint(1, 1200):04d}" for _ in range(ROWS)]
country = [rng.choice(COUNTRIES) for _ in range(ROWS)]
product = [rng.choice(PRODUCTS) for _ in range(ROWS)]
quantity = [rng.choices([1, 2, 3, 4], weights=[70, 18, 8, 4])[0] for _ in range(ROWS)]
unit_price = [Decimal(rng.randint(999, 24_999)) / 100 for _ in range(ROWS)]
total_usd = [p * q for p, q in zip(unit_price, quantity)]
discount = [
    (Decimal(rng.randint(5, 30)) / 100) if rng.random() < 0.25 else None
    for _ in range(ROWS)
]
status = [rng.choices(STATUSES, weights=[55, 20, 15, 6, 4])[0] for _ in range(ROWS)]
is_gift = [rng.random() < 0.07 for _ in range(ROWS)]

table = pa.table(
    {
        "order_id": pa.array(order_id, pa.int64()),
        "ordered_at": pa.array(ordered_at, pa.timestamp("us", tz="UTC")),
        "customer_id": pa.array(customer_id, pa.string()),
        "country": pa.array(country, pa.dictionary(pa.int32(), pa.string())),
        "product": pa.array(product, pa.dictionary(pa.int32(), pa.string())),
        "quantity": pa.array(quantity, pa.int32()),
        "unit_price": pa.array(unit_price, pa.decimal128(10, 2)),
        "total_usd": pa.array(total_usd, pa.decimal128(10, 2)),
        "discount": pa.array(discount, pa.decimal128(4, 2)),
        "status": pa.array(status, pa.dictionary(pa.int32(), pa.string())),
        "is_gift": pa.array(is_gift, pa.bool_()),
    }
)

path = OUT / "demo.parquet"
pq.write_table(table, path, compression="snappy", row_group_size=1_000)
print(f"{path} ({path.stat().st_size:,} bytes, {ROWS} rows)")
