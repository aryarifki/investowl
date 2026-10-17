"""Affiliated Broker & Insider Detection Engine for InvestOwl.

Detects when executing brokers have corporate governance ties, interlocking
directorates, common headquarters, conglomerate ownership, or substantial
shareholding relationships with the specific stock being analyzed.

Grounding note: Broker codes represent the executing member firm, not necessarily
the final beneficial client. These signals surface observational research leads,
never allegations of wrongdoing or insider trading.
"""
from __future__ import annotations

import re
from typing import Optional, Dict, Any, List
from sqlalchemy import text
from database import engine

# ═══════════════════════════════════════════════════════════════════
# 1. IDX BROKER MASTER DIRECTORY
# ═══════════════════════════════════════════════════════════════════

BROKER_DIRECTORY: Dict[str, Dict[str, str]] = {
    "II": {
        "name": "PT Danatama Makmur Sekuritas",
        "group": "Danatama Group",
        "type": "Local Institution",
    },
    "SQ": {
        "name": "PT BCA Sekuritas",
        "group": "BCA / Djarum Group",
        "type": "Local Institution",
    },
    "CC": {
        "name": "PT Mandiri Sekuritas",
        "group": "Bank Mandiri Group (BUMN)",
        "type": "Local Institution",
    },
    "NI": {
        "name": "PT BNI Sekuritas",
        "group": "BNI Group (BUMN)",
        "type": "Local Institution",
    },
    "OD": {
        "name": "PT BRI Danareksa Sekuritas",
        "group": "Bank BRI Group (BUMN)",
        "type": "Local Institution",
    },
    "DX": {
        "name": "PT Bahana Sekuritas",
        "group": "IFG / BUMN Group",
        "type": "Local Institution",
    },
    "EP": {
        "name": "PT MNC Sekuritas",
        "group": "MNC Group (Hary Tanoesoedibjo)",
        "type": "Local Institution",
    },
    "LG": {
        "name": "PT Trimegah Sekuritas Indonesia Tbk",
        "group": "Boy Thohir / Garibaldi Group",
        "type": "Local Institution",
    },
    "KI": {
        "name": "PT Ciptadana Sekuritas Asia",
        "group": "Lippo Group (Keluarga Riady)",
        "type": "Local Institution",
    },
    "AZ": {
        "name": "PT Sucor Sekuritas",
        "group": "Sucorinvest Group",
        "type": "Local Institution",
    },
    "HP": {
        "name": "PT Henan Putihrai Sekuritas",
        "group": "Henan / Tamaris Group",
        "type": "Local Institution",
    },
    "TP": {
        "name": "PT OCBC Sekuritas Indonesia",
        "group": "OCBC Bank Group",
        "type": "Local Institution",
    },
    "IF": {
        "name": "PT Samuel Sekuritas Indonesia",
        "group": "Samuel Group",
        "type": "Local Institution",
    },
    "PD": {
        "name": "PT Indo Premier Sekuritas",
        "group": "Indo Premier (IPOT)",
        "type": "Retail / Institution",
    },
    "YP": {
        "name": "PT Mirae Asset Sekuritas Indonesia",
        "group": "Mirae Asset Group (Korea)",
        "type": "Retail-Dominant",
    },
    "XL": {
        "name": "PT Stockbit Sekuritas Digital",
        "group": "Stockbit / Bibit",
        "type": "Retail-Dominant",
    },
    "XC": {
        "name": "PT Ajaib Sekuritas Asia",
        "group": "Ajaib Group",
        "type": "Retail-Dominant",
    },
    "AK": {
        "name": "PT UBS Sekuritas Indonesia",
        "group": "UBS AG (Swiss)",
        "type": "Foreign Smart Money",
    },
    "BK": {
        "name": "PT J.P. Morgan Sekuritas Indonesia",
        "group": "J.P. Morgan Chase & Co (US)",
        "type": "Foreign Smart Money",
    },
    "MS": {
        "name": "PT Morgan Stanley Sekuritas Indonesia",
        "group": "Morgan Stanley (US)",
        "type": "Foreign Smart Money",
    },
    "KZ": {
        "name": "PT CLSA Sekuritas Indonesia",
        "group": "CITIC / CLSA",
        "type": "Foreign Smart Money",
    },
    "CS": {
        "name": "PT Credit Suisse Sekuritas Indonesia",
        "group": "UBS / Credit Suisse",
        "type": "Foreign Smart Money",
    },
    "GR": {
        "name": "PT RHB Sekuritas Indonesia",
        "group": "RHB Bank Group (Malaysia)",
        "type": "Foreign Smart Money",
    },
    "ZP": {
        "name": "PT Maybank Sekuritas Indonesia",
        "group": "Maybank Group (Malaysia)",
        "type": "Foreign Smart Money",
    },
    "YU": {
        "name": "PT CGS International Sekuritas Indonesia",
        "group": "CGS International",
        "type": "Foreign Institution",
    },
    "RX": {
        "name": "PT Macquarie Sekuritas Indonesia",
        "group": "Macquarie Group (Australia)",
        "type": "Foreign Smart Money",
    },
    "GA": {
        "name": "PT Surya Fajar Sekuritas",
        "group": "Surya Fajar Capital",
        "type": "Local Speculative / Boutique",
    },
    "MG": {
        "name": "PT Semesta Indovest Sekuritas",
        "group": "Semesta Indovest",
        "type": "Speculative / Momentum",
    },
}

# ═══════════════════════════════════════════════════════════════════
# 2. DOCUMENTED CORPORATE & INSIDER TIES (INSTITUTIONAL KNOWLEDGE)
# ═══════════════════════════════════════════════════════════════════

DOCUMENTED_AFFILIATIONS: Dict[tuple[str, str], Dict[str, Any]] = {
    ("BULL", "II"): {
        "badge": "AFILIASI PENGENDALI & DIREKSI",
        "relation_type": "INTERLOCKING_BOARD_AND_OFFICE",
        "entity": "PT Danatama Makmur Sekuritas",
        "relation": (
            "Berbagi Komisaris Utama (Halim Jusuf) dan Direktur Utama (Henry Jusuf, mantan Direktur Danatama) "
            "dengan BULL, serta beralamat di kantor yang sama (Danatama Square II). "
            "Entitas terafiliasi Danatama memiliki porsi saham ~5.6% di BULL."
        ),
        "confidence": "CONFIRMED",
    },
    ("BBCA", "SQ"): {
        "badge": "ANAK USAHA EMITEN",
        "relation_type": "DIRECT_SUBSIDIARY",
        "entity": "PT BCA Sekuritas",
        "relation": "PT BCA Sekuritas adalah entitas anak terkonsolidasi langsung dari PT Bank Central Asia Tbk (Grup Djarum).",
        "confidence": "CONFIRMED",
    },
    ("BMRI", "CC"): {
        "badge": "ANAK USAHA BUMN",
        "relation_type": "DIRECT_SUBSIDIARY",
        "entity": "PT Mandiri Sekuritas",
        "relation": "PT Mandiri Sekuritas adalah anak perusahaan langsung dari PT Bank Mandiri (Persero) Tbk.",
        "confidence": "CONFIRMED",
    },
    ("BBNI", "NI"): {
        "badge": "ANAK USAHA BUMN",
        "relation_type": "DIRECT_SUBSIDIARY",
        "entity": "PT BNI Sekuritas",
        "relation": "PT BNI Sekuritas adalah anak perusahaan terkonsolidasi dari PT Bank Negara Indonesia (Persero) Tbk.",
        "confidence": "CONFIRMED",
    },
    ("BBRI", "OD"): {
        "badge": "ANAK USAHA BUMN",
        "relation_type": "DIRECT_SUBSIDIARY",
        "entity": "PT BRI Danareksa Sekuritas",
        "relation": "PT BRI Danareksa Sekuritas adalah anak usaha terafiliasi dari PT Bank Rakyat Indonesia (Persero) Tbk.",
        "confidence": "CONFIRMED",
    },
    ("ADRO", "LG"): {
        "badge": "AFILIASI PENGENDALI",
        "relation_type": "COMMON_CONTROLLER",
        "entity": "PT Trimegah Sekuritas Indonesia Tbk",
        "relation": "Garibaldi 'Boy' Thohir adalah pengendali dan pemilik saham signifikan pada PT Trimegah Sekuritas Indonesia Tbk.",
        "confidence": "HIGH",
    },
    ("ESSA", "LG"): {
        "badge": "AFILIASI PENGENDALI",
        "relation_type": "COMMON_CONTROLLER",
        "entity": "PT Trimegah Sekuritas Indonesia Tbk",
        "relation": "Garibaldi 'Boy' Thohir terafiliasi sebagai pemegang saham pengendali pada Trimegah Sekuritas dan emiten ESSA.",
        "confidence": "HIGH",
    },
    ("MBMA", "LG"): {
        "badge": "AFILIASI PENGENDALI",
        "relation_type": "COMMON_CONTROLLER",
        "entity": "PT Trimegah Sekuritas Indonesia Tbk",
        "relation": "Afiliasi ekosistem Merdeka / Thohir Group dengan PT Trimegah Sekuritas Indonesia Tbk.",
        "confidence": "HIGH",
    },
    ("BHIT", "EP"): {
        "badge": "ANAK USAHA KONGLOMERASI",
        "relation_type": "CONGLOMERATE_MEMBER",
        "entity": "PT MNC Sekuritas",
        "relation": "PT MNC Sekuritas berada di bawah naungan PT MNC Asia Holding Tbk (Grup MNC / Hary Tanoesoedibjo).",
        "confidence": "CONFIRMED",
    },
    ("KPIG", "EP"): {
        "badge": "AFILIASI KONGLOMERASI",
        "relation_type": "CONGLOMERATE_MEMBER",
        "entity": "PT MNC Sekuritas",
        "relation": "Entitas grup sekuritas dari ekosistem MNC Group (Hary Tanoesoedibjo).",
        "confidence": "CONFIRMED",
    },
    ("MNCN", "EP"): {
        "badge": "AFILIASI KONGLOMERASI",
        "relation_type": "CONGLOMERATE_MEMBER",
        "entity": "PT MNC Sekuritas",
        "relation": "Entitas sekuritas terafiliasi dari ekosistem media & investasi MNC Group.",
        "confidence": "CONFIRMED",
    },
    ("BMTR", "EP"): {
        "badge": "AFILIASI KONGLOMERASI",
        "relation_type": "CONGLOMERATE_MEMBER",
        "entity": "PT MNC Sekuritas",
        "relation": "Entitas sekuritas terafiliasi di bawah bendera konglomerasi MNC Group.",
        "confidence": "CONFIRMED",
    },
    ("LPKR", "KI"): {
        "badge": "AFILIASI KONGLOMERASI",
        "relation_type": "CONGLOMERATE_MEMBER",
        "entity": "PT Ciptadana Sekuritas Asia",
        "relation": "PT Ciptadana Sekuritas Asia terafiliasi dengan keluarga Riady / Lippo Group.",
        "confidence": "HIGH",
    },
    ("SILO", "KI"): {
        "badge": "AFILIASI KONGLOMERASI",
        "relation_type": "CONGLOMERATE_MEMBER",
        "entity": "PT Ciptadana Sekuritas Asia",
        "relation": "Ciptadana Sekuritas terafiliasi di bawah ekosistem konglomerasi Lippo Group.",
        "confidence": "HIGH",
    },
}


# ═══════════════════════════════════════════════════════════════════
# 3. DYNAMIC DETECTION & EVALUATION ENGINE
# ═══════════════════════════════════════════════════════════════════

def get_broker_info(broker_code: str) -> Dict[str, str]:
    """Mengembalikan informasi profil broker berdasarkan kode 2 huruf."""
    code = (broker_code or "").upper().strip()
    info = BROKER_DIRECTORY.get(code)
    if info:
        return {"code": code, **info}
    return {
        "code": code,
        "name": f"Broker {code}",
        "group": "Unknown",
        "type": "Other Broker",
    }


def check_dynamic_board_match(ticker: str, broker_code: str) -> Optional[Dict[str, Any]]:
    """Mengecek apakah nama pengurus emiten (Direksi/Komisaris) terkait dengan broker."""
    code = (broker_code or "").upper().strip()
    b_info = BROKER_DIRECTORY.get(code)
    if not b_info:
        return None

    # Khusus Danatama (II) ↔ Halim Jusuf / Henry Jusuf
    if code == "II":
        try:
            with engine.connect() as conn:
                q = text("""
                    SELECT name, role, title FROM company_board 
                    WHERE ticker = :ticker AND (name ILIKE '%Jusuf%' OR name ILIKE '%Danatama%')
                """)
                res = conn.execute(q, {"ticker": ticker}).fetchall()
                if res:
                    names = [f"{r[0]} ({r[2] or r[1]})" for r in res]
                    return {
                        "badge": "INTERLOCKING BOARD",
                        "relation_type": "BOARD_INTERLOCK",
                        "entity": b_info["name"],
                        "relation": f"Terdeteksi kesamaan nama pengurus emiten dengan pendiri/komisaris Danatama: {', '.join(names)}.",
                        "confidence": "HIGH",
                    }
        except Exception:
            pass

    return None


def get_broker_affiliation(ticker: str, broker_code: str) -> Optional[Dict[str, Any]]:
    """Evaluasi komprehensif apakah sebuah broker terafiliasi dengan emiten tertentu."""
    ticker_clean = (ticker or "").upper().strip()
    code_clean = (broker_code or "").upper().strip()

    # 1. Cek dari Institutional Knowledge Base (Confirmed)
    if (ticker_clean, code_clean) in DOCUMENTED_AFFILIATIONS:
        doc = DOCUMENTED_AFFILIATIONS[(ticker_clean, code_clean)]
        b_info = get_broker_info(code_clean)
        return {
            "is_affiliated": True,
            "broker_code": code_clean,
            "broker_name": b_info.get("name", f"Broker {code_clean}"),
            "broker_group": b_info.get("group", "-"),
            "badge": doc["badge"],
            "relation_type": doc["relation_type"],
            "relation": doc["relation"],
            "confidence": doc["confidence"],
            "disclaimer": "Observational research lead berdasarkan data keterbukaan publik, bukan tuduhan insider trading.",
        }

    # 2. Cek Dinamis Board / Management Match
    dynamic_match = check_dynamic_board_match(ticker_clean, code_clean)
    if dynamic_match:
        b_info = get_broker_info(code_clean)
        return {
            "is_affiliated": True,
            "broker_code": code_clean,
            "broker_name": b_info.get("name", f"Broker {code_clean}"),
            "broker_group": b_info.get("group", "-"),
            "badge": dynamic_match["badge"],
            "relation_type": dynamic_match["relation_type"],
            "relation": dynamic_match["relation"],
            "confidence": dynamic_match["confidence"],
            "disclaimer": "Observational research lead berdasarkan data keterbukaan publik, bukan tuduhan insider trading.",
        }

    return None


def enrich_broker_summary_affiliations(ticker: str, broker_summary_list: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Menyematkan metadata afiliasi ke setiap baris broker summary dan merangkum yang terdeteksi."""
    enriched_list = []
    detected_affiliations = []

    for row in broker_summary_list:
        b_code = str(row.get("broker") or row.get("broker_code") or "").upper().strip()
        aff = get_broker_affiliation(ticker, b_code)
        b_info = get_broker_info(b_code)

        new_row = dict(row)
        new_row["broker_name"] = b_info.get("name", f"Broker {b_code}")
        
        if aff:
            new_row["is_affiliated"] = True
            new_row["affiliation"] = aff
            detected_affiliations.append({
                "broker_code": b_code,
                "broker_name": aff["broker_name"],
                "side": row.get("side", "Active"),
                "net": row.get("net", 0),
                "badge": aff["badge"],
                "relation": aff["relation"],
                "confidence": aff["confidence"],
            })
        else:
            new_row["is_affiliated"] = False
            new_row["affiliation"] = None

        enriched_list.append(new_row)

    return enriched_list, detected_affiliations


def detect_window_affiliations(ticker: str, activity_window: Any) -> List[Dict[str, Any]]:
    """Mendeteksi seluruh broker terafiliasi yang aktif bertransaksi dalam lookback window."""
    import pandas as pd

    if activity_window is None or getattr(activity_window, "empty", True) or "broker_code" not in activity_window.columns:
        return []

    detected = []
    ticker_clean = (ticker or "").upper().strip()

    for code, grp in activity_window.groupby("broker_code"):
        code_str = str(code).upper().strip()
        aff = get_broker_affiliation(ticker_clean, code_str)
        if aff:
            cum_net = float(grp["net_value"].fillna(0).sum())
            days_active = int(grp["date"].nunique())
            latest_row = grp.sort_values("date").iloc[-1]
            detected.append({
                "broker_code": code_str,
                "broker_name": aff["broker_name"],
                "broker_group": aff.get("broker_group", "-"),
                "badge": aff["badge"],
                "relation_type": aff.get("relation_type", "AFFILIATION"),
                "relation": aff["relation"],
                "confidence": aff["confidence"],
                "cumulative_net": cum_net,
                "days_active": days_active,
                "latest_net": float(latest_row.get("net_value", 0)),
                "latest_date": str(pd.Timestamp(latest_row["date"]).date()),
                "disclaimer": aff["disclaimer"],
            })

    detected.sort(key=lambda x: abs(x["cumulative_net"]), reverse=True)
    return detected

