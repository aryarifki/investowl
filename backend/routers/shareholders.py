"""Shareholders and Corporate Ownership Matrix endpoints."""
from __future__ import annotations

from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(prefix="/api/bandar/shareholders", tags=["Shareholders & Ownership"])


def _classify_shareholder(name: str, pct: float, is_controlling: bool) -> str:
    name_clean = name.strip().lower()
    if is_controlling:
        return "controlling"
    if "treasury" in name_clean:
        return "treasury"
    if name_clean.startswith("masyarakat") or name_clean.startswith("publik"):
        return "public"
    if pct >= 5.0:
        return "substantial"
    return "management"


@router.get(
    "/top-cross-holdings",
    summary="Daftar entitas pengendali/pemegang saham multi-emiten di BEI",
)
def get_top_cross_holdings(
    limit: int = Query(25, ge=1, le=100, description="Jumlah maksimal entitas yang dikembalikan"),
    min_holdings: int = Query(2, ge=2, le=20, description="Minimal kepemilikan saham pada berapa emiten"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Mengembalikan daftar entitas/pemilik yang memiliki porsi saham di beberapa emiten sekaligus."""
    query = text("""
        SELECT 
            name, 
            COUNT(DISTINCT ticker) as ticker_count,
            SUM(pct) as total_pct,
            json_agg(
                json_build_object(
                    'ticker', ticker, 
                    'pct', pct, 
                    'is_controlling', is_controlling
                ) ORDER BY pct DESC
            ) as holdings
        FROM company_shareholders
        WHERE name NOT ILIKE 'Masyarakat%' 
          AND name NOT ILIKE 'Saham Treasury%' 
          AND name NOT ILIKE 'Publik%'
          AND name NOT IN ('-', 'Pengendali Saham', 'Non Pengendali Saham', 'Others', 'Lain-lain')
        GROUP BY name
        HAVING COUNT(DISTINCT ticker) >= :min_holdings
        ORDER BY ticker_count DESC, total_pct DESC, name ASC
        LIMIT :limit
    """)
    
    rows = db.execute(query, {"min_holdings": min_holdings, "limit": limit}).fetchall()
    
    results = []
    for r in rows:
        raw_holdings = r[3] or []
        formatted_holdings = [
            {
                "ticker": h.get("ticker", ""),
                "pct": round(float(h.get("pct", 0.0) or 0.0), 3),
                "is_controlling": bool(h.get("is_controlling", False)),
            }
            for h in raw_holdings
        ]
        results.append({
            "name": r[0],
            "ticker_count": int(r[1]),
            "total_pct": round(float(r[2] or 0.0), 2),
            "holdings": formatted_holdings,
        })
    
    return results


@router.get(
    "/search",
    summary="Pencarian entitas atau pemegang saham dan portofolio kepemilikannya",
)
def search_shareholders(
    q: str = Query(..., min_length=2, description="Kata kunci nama pemilik atau entitas"),
    limit: int = Query(30, ge=1, le=100, description="Maksimum hasil"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Cari entitas pemegang saham berdasarkan nama dan tampilkan seluruh emiten yang dimiliki."""
    search_term = f"%{q.strip()}%"
    
    query = text("""
        SELECT 
            name, 
            COUNT(DISTINCT ticker) as ticker_count,
            SUM(pct) as total_pct,
            json_agg(
                json_build_object(
                    'ticker', ticker, 
                    'pct', pct, 
                    'is_controlling', is_controlling
                ) ORDER BY pct DESC
            ) as holdings
        FROM company_shareholders
        WHERE name ILIKE :search_term
        GROUP BY name
        ORDER BY ticker_count DESC, total_pct DESC, name ASC
        LIMIT :limit
    """)
    
    rows = db.execute(query, {"search_term": search_term, "limit": limit}).fetchall()
    
    results = []
    for r in rows:
        raw_holdings = r[3] or []
        formatted_holdings = [
            {
                "ticker": h.get("ticker", ""),
                "pct": round(float(h.get("pct", 0.0) or 0.0), 3),
                "is_controlling": bool(h.get("is_controlling", False)),
            }
            for h in raw_holdings
        ]
        results.append({
            "name": r[0],
            "ticker_count": int(r[1]),
            "total_pct": round(float(r[2] or 0.0), 2),
            "holdings": formatted_holdings,
        })
    
    return {
        "query": q,
        "count": len(results),
        "results": results,
    }


CONGLOMERATE_GROUPS: dict[str, dict[str, Any]] = {
    "barito": {
        "id": "barito",
        "name": "Barito Pacific / Prajogo Pangestu",
        "description": "Konglomerasi petrokimia, energi baru terbarukan, dan tambang.",
        "hub_entity": "Prajogo Pangestu",
        "patterns": ["%PRAJOGO PANGESTU%", "%BARITO%", "%CHANDRA ASRI%", "%PETRINDO%"],
        "known_tickers": ["BREN", "BRPT", "CDIA", "CUAN", "STRK", "TPIA"],
    },
    "salim": {
        "id": "salim",
        "name": "Salim Group / Anthoni Salim",
        "description": "Konglomerasi konsumen primer, agribisnis, ritel, data center, dan infrastruktur.",
        "hub_entity": "Anthoni Salim",
        "patterns": ["%SALIM%", "%INDOFOOD%", "%FIRST PACIFIC%"],
        "known_tickers": ["INDF", "ICBP", "SIMP", "LSIP", "DNET", "DCII", "EMTK", "FAST", "MEDC"],
    },
    "astra": {
        "id": "astra",
        "name": "Astra International Group",
        "description": "Grup otomotif, alat berat, agribisnis, dan jasa keuangan terbesar Indonesia.",
        "hub_entity": "PT Astra International Tbk",
        "patterns": ["%ASTRA%"],
        "known_tickers": ["ASII", "AALI", "ASGR", "AUTO", "UNTR", "HEAL"],
    },
    "djarum": {
        "id": "djarum",
        "name": "Djarum / Hartono Brothers",
        "description": "Konglomerasi perbankan swasta terbesar, menara telekomunikasi, dan e-commerce.",
        "hub_entity": "Robert Budi Hartono & Michael Hartono",
        "patterns": ["%DWIMURIA%", "%HARTONO%", "%SARANA MENARA%"],
        "known_tickers": ["BBCA", "TOWR", "SUPR", "RANC", "BELI"],
    },
    "sinarmas": {
        "id": "sinarmas",
        "name": "Sinar Mas / Widjaja Family",
        "description": "Konglomerasi pulp & paper, agribisnis, energi, jasa keuangan, dan properti.",
        "hub_entity": "Sinar Mas / Widjaja Family",
        "patterns": ["%SINAR MAS%", "%SINARMAS%", "%DIAN SWASTATIKA%"],
        "known_tickers": ["DSSA", "GEMS", "BSIM", "LIFE", "SMMA", "INKP", "TKIM", "BSDE"],
    },
    "adaro": {
        "id": "adaro",
        "name": "Adaro Energy / Boy Thohir",
        "description": "Konglomerasi energi batubara, green power, kimia, dan investasi pertambangan.",
        "hub_entity": "Garibaldi Thohir",
        "patterns": ["%ADARO%", "%GARIBALDI THOHIR%"],
        "known_tickers": ["ADRO", "AADI", "MDKA", "ESSA", "PALM", "TRIM"],
    },
    "lippo": {
        "id": "lippo",
        "name": "Lippo Group / Mochtar Riady",
        "description": "Konglomerasi properti, rumah sakit, ritel modern, dan telekomunikasi.",
        "hub_entity": "PT Inti Anugerah Pratama (Riady Family)",
        "patterns": ["%LIPPO%", "%INTI ANUGERAH PRATAMA%"],
        "known_tickers": ["LPKR", "MLPL", "LPPS", "LPGI", "LPLI", "SILO"],
    },
    "mnc": {
        "id": "mnc",
        "name": "MNC Group / Hary Tanoesoedibjo",
        "description": "Konglomerasi media terintegrasi, hospitality/resort, dan jasa keuangan.",
        "hub_entity": "Hary Tanoesoedibjo",
        "patterns": ["%MNC%", "%HARY TANOE%", "%GLOBAL MEDIACCOM%"],
        "known_tickers": ["BMTR", "MNCN", "BCAP", "BABP", "KPIG", "MSKY"],
    },
    "bakrie": {
        "id": "bakrie",
        "name": "Bakrie Group",
        "description": "Konglomerasi sumber daya alam, energi, infrastruktur, EV, dan media.",
        "hub_entity": "Bakrie & Brothers",
        "patterns": ["%BAKRIE%"],
        "known_tickers": ["BNBR", "BRMS", "ENRG", "VKTR", "VIVA", "BTEL", "ALII", "UNSP"],
    },
    "harita": {
        "id": "harita",
        "name": "Harita Group / Lim Family",
        "description": "Konglomerasi pertambangan nikel terintegrasi, smelter HPAL, dan bauksit.",
        "hub_entity": "PT Harita Jayaraya",
        "patterns": ["%HARITA%"],
        "known_tickers": ["NCKL", "CITA"],
    },
    "medco": {
        "id": "medco",
        "name": "Medco Energi / Panigoro Family",
        "description": "Konglomerasi migas, tambang tembaga-emas, dan pembangkit listrik.",
        "hub_entity": "Hilmi Panigoro / Medco Daya",
        "patterns": ["%MEDCO%"],
        "known_tickers": ["MEDC", "AMMN"],
    },
    "emtek": {
        "id": "emtek",
        "name": "Elang Mahkota Teknologi (Emtek)",
        "description": "Konglomerasi media siaran, teknologi digital, dan jaringan layanan kesehatan.",
        "hub_entity": "Eddy Kusnadi Sariaatmadja",
        "patterns": ["%ELANG MAHKOTA%", "%SARIAATMADJA%"],
        "known_tickers": ["EMTK", "SCMA", "BUKA", "SAME"],
    },
}

KNOWN_NAME_TO_TICKER: dict[str, str] = {
    "pt barito pacific tbk": "BRPT",
    "pt chandra asri pacific tbk": "TPIA",
    "pt chandra asri petrochemical tbk": "TPIA",
    "pt petrindo jaya kreasi tbk": "CUAN",
    "pt barito renewables energy tbk": "BREN",
    "pt indofood sukses makmur tbk": "INDF",
    "pt indofood cbp sukses makmur tbk": "ICBP",
    "pt astra international tbk": "ASII",
    "pt sarana menara nusantara tbk": "TOWR",
    "pt djarum": "BBCA",
    "pt dwimuria investama andalan": "BBCA",
    "pt dian swastatika sentosa tbk": "DSSA",
    "pt adaro energy indonesia tbk": "ADRO",
    "pt adaro andalan indonesia tbk": "AADI",
    "pt merdeka copper gold tbk": "MDKA",
    "pt elang mahkota teknologi tbk": "EMTK",
    "pt surya citra media tbk": "SCMA",
    "pt global mediacom tbk": "BMTR",
    "pt bakrie & brothers tbk": "BNBR",
    "pt bakrie and brothers tbk": "BNBR",
    "pt harita jayaraya": "NCKL",
    "pt medco energi internasional tbk": "MEDC",
    "pt multipolar tbk": "MLPL",
    "pt lippo karawaci tbk": "LPKR",
}


@router.get(
    "/groups",
    summary="Daftar grup konglomerasi yang telah dipetakan di BEI",
)
def get_conglomerate_groups() -> dict[str, Any]:
    """Mengembalikan daftar preset grup konglomerasi beserta deskripsi dan emiten utamanya."""
    groups_list = []
    for g_id, g in CONGLOMERATE_GROUPS.items():
        groups_list.append({
            "id": g["id"],
            "name": g["name"],
            "description": g["description"],
            "hub_entity": g["hub_entity"],
            "sample_tickers": g["known_tickers"],
            "ticker_count": len(g["known_tickers"]),
        })
    return {"groups": groups_list}


@router.get(
    "/network-graph",
    summary="Data graph jejaring kepemilikan konglomerasi / emiten",
)
def get_ownership_network_graph(
    group: Optional[str] = "barito",
    ticker: Optional[str] = None,
    min_pct: float = Query(1.0, ge=0.1, le=50.0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Membuat struktur simpul (nodes) dan sisi (links) graf kepemilikan silang emiten dan pemegang saham."""
    import re

    target_ticker = ticker.upper().strip() if ticker else None
    group_key = (group or "barito").lower().strip()
    group_data = CONGLOMERATE_GROUPS.get(group_key, CONGLOMERATE_GROUPS["barito"])

    if target_ticker:
        q_direct = text("""
            SELECT ticker, name, pct, is_controlling
            FROM company_shareholders
            WHERE ticker = :ticker
              AND name NOT ILIKE 'Masyarakat%'
              AND name NOT ILIKE 'Publik%'
              AND name NOT ILIKE '%Treasury%'
              AND pct >= :min_pct
            ORDER BY pct DESC
        """)
        direct_rows = db.execute(q_direct, {"ticker": target_ticker, "min_pct": min_pct}).fetchall()

        sh_names = [r[1] for r in direct_rows]

        sibling_rows = []
        if sh_names:
            q_sibs = text("""
                SELECT ticker, name, pct, is_controlling
                FROM company_shareholders
                WHERE name = ANY(:sh_names)
                  AND ticker != :ticker
                  AND name NOT ILIKE 'Masyarakat%'
                  AND name NOT ILIKE 'Publik%'
                  AND name NOT ILIKE '%Treasury%'
                  AND pct >= :min_pct
                ORDER BY pct DESC
                LIMIT 40
            """)
            sibling_rows = db.execute(q_sibs, {"sh_names": sh_names, "ticker": target_ticker, "min_pct": min_pct}).fetchall()

        all_rows = list(direct_rows) + list(sibling_rows)
        active_tickers = list(set([target_ticker] + [r[0] for r in all_rows]))
        graph_title = f"Jejaring Kepemilikan {target_ticker}"
        hub_name = target_ticker
    else:
        active_tickers = group_data["known_tickers"]
        q_group = text("""
            SELECT ticker, name, pct, is_controlling
            FROM company_shareholders
            WHERE ticker = ANY(:tickers)
              AND name NOT ILIKE 'Masyarakat%'
              AND name NOT ILIKE 'Publik%'
              AND name NOT ILIKE '%Treasury%'
              AND pct >= :min_pct
            ORDER BY ticker, pct DESC
        """)
        all_rows = db.execute(q_group, {"tickers": active_tickers, "min_pct": min_pct}).fetchall()
        graph_title = group_data["name"]
        hub_name = group_data["hub_entity"]

    q_comp = text("""
        SELECT DISTINCT ON (ticker) ticker, company_name, group_name
        FROM analytics_foreign_flow
        WHERE ticker = ANY(:tickers)
    """)
    comp_map = {
        r[0]: {"name": r[1] or r[0], "sector": r[2] or "-"}
        for r in db.execute(q_comp, {"tickers": active_tickers}).fetchall()
    }

    nodes_dict: dict[str, dict[str, Any]] = {}
    links: list[dict[str, Any]] = []

    for t in active_tickers:
        t_id = f"emiten:{t}"
        c_info = comp_map.get(t, {})
        nodes_dict[t_id] = {
            "id": t_id,
            "label": t,
            "name": c_info.get("name", t),
            "type": "emiten",
            "sector": c_info.get("sector", "-"),
            "is_controlling": False,
            "degree": 0,
            "val": 26 if t == target_ticker else 20,
        }

    for r in all_rows:
        t, owner_name, pct, is_ctrl = r[0], r[1], float(r[2]), bool(r[3])
        owner_clean = owner_name.strip().lower()

        if owner_clean in KNOWN_NAME_TO_TICKER and KNOWN_NAME_TO_TICKER[owner_clean] in active_tickers:
            source_id = f"emiten:{KNOWN_NAME_TO_TICKER[owner_clean]}"
        else:
            slug = re.sub(r"[^a-zA-Z0-9]+", "-", owner_clean).strip("-")[:40]
            source_id = f"owner:{slug}"
            if source_id not in nodes_dict:
                is_hub = any(h.lower() in owner_clean for h in hub_name.lower().split("/"))
                short_label = owner_name if len(owner_name) <= 22 else owner_name[:20] + "..."
                nodes_dict[source_id] = {
                    "id": source_id,
                    "label": short_label,
                    "name": owner_name,
                    "type": "hub" if is_hub else "owner",
                    "sector": "Pengendali / Pemegang Saham",
                    "is_controlling": is_ctrl,
                    "degree": 0,
                    "val": 30 if is_hub else 16,
                }

        target_id = f"emiten:{t}"

        if source_id in nodes_dict:
            nodes_dict[source_id]["degree"] += 1
        if target_id in nodes_dict:
            nodes_dict[target_id]["degree"] += 1

        links.append({
            "source": source_id,
            "target": target_id,
            "pct": round(pct, 2),
            "is_controlling": is_ctrl,
            "label": f"{pct:.1f}%",
        })

    avail_groups = [
        {"id": g["id"], "name": g["name"], "ticker_count": len(g["known_tickers"])}
        for g in CONGLOMERATE_GROUPS.values()
    ]

    return {
        "group_id": group_key,
        "group_name": graph_title,
        "hub_entity": hub_name,
        "nodes": list(nodes_dict.values()),
        "links": links,
        "stats": {
            "total_nodes": len(nodes_dict),
            "total_emitens": len(active_tickers),
            "total_links": len(links),
            "hub_entity": hub_name,
        },
        "available_groups": avail_groups,
    }


@router.get(
    "/{ticker}",
    summary="Struktur pemegang saham lengkap untuk satu emiten",
)
def get_stock_shareholders(
    ticker: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Mengembalikan daftar pemegang saham, klasifikasi, serta ringkasan porsi pengendali vs publik."""
    norm_ticker = ticker.upper().replace(".JK", "").strip()
    
    query = text("""
        SELECT name, pct, is_controlling
        FROM company_shareholders
        WHERE ticker = :ticker
        ORDER BY pct DESC, name ASC
    """)
    
    rows = db.execute(query, {"ticker": norm_ticker}).fetchall()
    
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Tidak ada data pemegang saham untuk ticker '{norm_ticker}'",
        )
    
    shareholders = []
    controlling_pct = 0.0
    other_substantial_pct = 0.0
    public_pct = 0.0
    treasury_pct = 0.0
    management_pct = 0.0
    controlling_entities = []
    
    for r in rows:
        name = r[0]
        pct = round(float(r[1] or 0.0), 4)
        is_ctrl = bool(r[2])
        cat = _classify_shareholder(name, pct, is_ctrl)
        
        if cat == "controlling":
            controlling_pct += pct
            controlling_entities.append(name)
        elif cat == "treasury":
            treasury_pct += pct
        elif cat == "public":
            public_pct += pct
        elif cat == "substantial":
            other_substantial_pct += pct
        else:
            management_pct += pct
        
        shareholders.append({
            "name": name,
            "pct": pct,
            "is_controlling": is_ctrl,
            "category": cat,
        })
    
    return {
        "ticker": norm_ticker,
        "count": len(shareholders),
        "shareholders": shareholders,
        "summary": {
            "controlling_pct": round(controlling_pct, 2),
            "other_substantial_pct": round(other_substantial_pct, 2),
            "public_pct": round(public_pct, 2),
            "treasury_pct": round(treasury_pct, 2),
            "management_pct": round(management_pct, 2),
            "free_float_est": round(public_pct, 2),
            "controlling_entities": controlling_entities,
        },
    }
