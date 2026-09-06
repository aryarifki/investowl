"""Feature engineering — turns raw `prices` + `broker_flow` tables into one
tidy feature table for analysis & modeling.

Core idea for the hypothesis test ("does smart money flow affect price?"):
for each (ticker, date) where we have a broker/bandar snapshot, compute the
*forward* price return over the next N days, so we can ask "when bandar/asing
accumulated today, did price actually go up afterwards?" — not just same-day
correlation, which can be circular (heavy buying same day mechanically pushes
price up).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import storage


def build_price_features(price_df: pd.DataFrame) -> pd.DataFrame:
    """Add daily return + rolling volume features per ticker."""
    if price_df.empty:
        return price_df
    df = price_df.sort_values(["ticker", "date"]).copy()
    g = df.groupby("ticker", group_keys=False)
    df["return_1d"] = g["close"].pct_change()
    df["volume_avg_5d"] = g["volume"].transform(lambda s: s.rolling(5, min_periods=1).mean())
    df["volume_ratio"] = df["volume"] / df["volume_avg_5d"].replace(0, np.nan)
    return df


def add_forward_returns(price_df: pd.DataFrame, horizons: tuple[int, ...] = (1, 3, 5, 10)) -> pd.DataFrame:
    """Add forward (future) close-to-close return columns: fwd_return_{h}d.

    fwd_return_5d on row (ticker, date) = return from `date` close to the
    close 5 trading days later. This is the target variable for "did smart
    money inflow predict a later price increase".
    """
    df = price_df.sort_values(["ticker", "date"]).copy()
    for h in horizons:
        df[f"fwd_return_{h}d"] = (
            df.groupby("ticker")["close"].shift(-h) / df["close"] - 1.0
        )
    return df


def add_backward_returns(price_df: pd.DataFrame, horizons: tuple[int, ...] = (1, 3, 5, 10)) -> pd.DataFrame:
    """Add backward (historical) close-to-close return columns: back_return_{h}d.

    back_return_5d on row (ticker, date) = return from the close 5 trading
    days earlier to today's close. This is immediately available on the latest
    broker snapshot date, unlike forward returns which require future prices.
    """
    df = price_df.sort_values(["ticker", "date"]).copy()
    for h in horizons:
        df[f"back_return_{h}d"] = (
            df["close"] / df.groupby("ticker")["close"].shift(h) - 1.0
        )
    return df


def build_feature_table(tickers: list[str] | None = None,
                         horizons: tuple[int, ...] = (1, 3, 5, 10)) -> pd.DataFrame:
    """The main entry point: one tidy DataFrame, one row per (ticker, date)
    that has a broker/bandar snapshot, joined with same-day price features
    and forward returns.

    Columns include:
      ticker, date, close, return_1d, volume_ratio,
      bandar_signal, bandar_signal_score, foreign_net_broker, foreign_net_flow,
      foreign_signal, ... , fwd_return_1d, fwd_return_3d, fwd_return_5d, fwd_return_10d
    """
    price_df = storage.read_prices(tickers)
    broker_df = storage.read_broker_flow(tickers)

    if price_df.empty:
        return pd.DataFrame()

    price_df = build_price_features(price_df)
    price_df = add_forward_returns(price_df, horizons=horizons)
    price_df = add_backward_returns(price_df, horizons=horizons)

    if broker_df.empty:
        # Still useful (pure price analysis), but flag it clearly.
        out = price_df.copy()
        for c in ["bandar_signal", "bandar_signal_score", "foreign_net_broker",
                  "foreign_net_flow", "foreign_signal"]:
            out[c] = np.nan
        return out

    merged = pd.merge(broker_df, price_df, on=["ticker", "date"], how="left", suffixes=("", "_px"))

    # Convenience: normalize foreign net flow by total transaction value, so
    # it's comparable across tickers of very different liquidity.
    merged["foreign_net_flow_pct"] = np.where(
        merged["total_value"].fillna(0) > 0,
        merged["foreign_net_flow"] / merged["total_value"] * 100,
        np.nan,
    )

    # Encode the categorical bandar signal as a numeric score too, in case
    # bandar_signal_score is missing for some rows.
    score_map = {
        "STRONG_ACCUMULATION": 2, "ACCUMULATION": 1, "NEUTRAL": 0,
        "DISTRIBUTION": -1, "STRONG_DISTRIBUTION": -2,
        "AKUMULASI_KUAT": 2, "AKUMULASI": 1, "NETRAL": 0,
        "DISTRIBUSI": -1, "DISTRIBUSI_KUAT": -2,
        "NET_BUY": 1, "NET_SELL": -1,
    }
    merged["bandar_signal_score"] = merged["bandar_signal_score"].fillna(
        merged["bandar_signal"].map(score_map)
    )

    return merged.sort_values(["ticker", "date"]).reset_index(drop=True)
