import pytest
import pandas as pd
from app.routers.bandarmology import _broker_distribution_data_range

@pytest.fixture
def complex_activity_df():
    """Dataset sintetis transaksi multi-broker, multi-hari, dan multi-tipe."""
    return pd.DataFrame({
        "date": pd.to_datetime([
            "2026-09-01", "2026-09-01", "2026-09-01", "2026-09-01",
            "2026-09-02", "2026-09-02",
            "2026-09-05"  # Di luar jendela pengujian
        ]),
        "broker_code": ["AK", "YP", "PD", "CC", "AK", "YP", "KZ"],
        "participant_type": ["Asing", "Lokal", "Lokal", "Pemerintah", "Asing", "Lokal", "Asing"],
        "buy_value": [
            1_000_000_000, 0, 0, 500_000_000,
            500_000_000, 0,
            2_000_000_000
        ],
        "sell_value": [
            0, 600_000_000, 400_000_000, 500_000_000,
            0, 500_000_000,
            0
        ],
        "net_value": [
            1_000_000_000, -600_000_000, -400_000_000, 0,
            500_000_000, -500_000_000,
            2_000_000_000
        ],
        "frequency": [100, 80, 50, 40, 60, 70, 150],
        "buy_lot": [10_000, 0, 0, 5_000, 5_000, 0, 20_000],
        "sell_lot": [0, 6_000, 4_000, 5_000, 0, 5_000, 0],
        "buy_avg_price": [1000, 0, 0, 1000, 1000, 0, 1000],
        "sell_avg_price": [0, 1000, 1000, 1000, 0, 1000, 0],
    })


def test_single_day_greedy_matching(complex_activity_df):
    """Menguji penyusunan counterparty 1 buyer ke banyak seller (partial matching) pada 1 hari."""
    start = pd.to_datetime("2026-09-01")
    end = pd.to_datetime("2026-09-01")

    res = _broker_distribution_data_range(complex_activity_df, start, end)

    # 1. Validasi rentang tanggal
    assert res["dist_start"] == "2026-09-01"
    assert res["dist_end"] == "2026-09-01"

    # 2. Buyer net: AK beli 1.000.000.000
    assert len(res["buyers"]) == 1
    assert res["buyers"][0]["broker"] == "AK"
    assert res["buyers"][0]["type"] == "FOREIGN"
    assert res["buyers"][0]["net_value"] == 1_000_000_000

    # 3. Sellers net: YP (-600 jt) dan PD (-400 jt)
    assert len(res["sellers"]) == 2
    seller_codes = [s["broker"] for s in res["sellers"]]
    assert seller_codes == ["YP", "PD"]

    # 4. Filter netral: CC net_value 0 tidak boleh masuk
    assert "CC" not in seller_codes
    assert "CC" not in [b["broker"] for b in res["buyers"]]

    # 5. Greedy matching edge calculation:
    # AK (1 M) menyerap YP (600 jt) -> sisa AK 400 jt -> menyerap PD (400 jt)
    assert len(res["edges"]) == 2
    assert res["edges"][0]["buyer_code"] == "AK"
    assert res["edges"][0]["seller_code"] == "YP"
    assert res["edges"][0]["matched_value"] == 600_000_000

    assert res["edges"][1]["buyer_code"] == "AK"
    assert res["edges"][1]["seller_code"] == "PD"
    assert res["edges"][1]["matched_value"] == 400_000_000


def test_multi_day_date_range_aggregation(complex_activity_df):
    """Menguji agregasi kumulatif jika user memilih rentang beberapa hari (2026-09-01 s/d 2026-09-02)."""
    start = pd.to_datetime("2026-09-01")
    end = pd.to_datetime("2026-09-02")

    res = _broker_distribution_data_range(complex_activity_df, start, end)

    # AK harus terakumulasi: 1 M (tgl 1) + 500 jt (tgl 2) = 1,5 M
    ak_buyer = next(b for b in res["buyers"] if b["broker"] == "AK")
    assert ak_buyer["buy_value"] == 1_500_000_000
    assert ak_buyer["net_value"] == 1_500_000_000
    assert ak_buyer["buy_lot"] == 15_000

    # YP harus terakumulasi: 600 jt + 500 jt = 1,1 M
    yp_seller = next(s for s in res["sellers"] if s["broker"] == "YP")
    assert yp_seller["sell_value"] == 1_100_000_000
    assert yp_seller["net_value"] == -1_100_000_000

    # KZ pada 2026-09-05 tidak boleh ikut terhitung
    assert "KZ" not in [b["broker"] for b in res["buyers"]]


def test_empty_or_out_of_range(complex_activity_df):
    """Menguji penanganan ketika tidak ada transaksi pada tanggal yang diminta."""
    start = pd.to_datetime("2026-01-01")
    end = pd.to_datetime("2026-01-05")

    res = _broker_distribution_data_range(complex_activity_df, start, end)
    assert res["buyers"] == []
    assert res["sellers"] == []
    assert res["edges"] == []


def test_empty_dataframe_input():
    """Menguji ketahanan fungsi saat menerima DataFrame kosong."""
    empty_df = pd.DataFrame()
    start = pd.to_datetime("2026-09-01")
    end = pd.to_datetime("2026-09-01")

    res = _broker_distribution_data_range(empty_df, start, end)
    assert res["buyers"] == []
    assert res["sellers"] == []
    assert res["edges"] == []
