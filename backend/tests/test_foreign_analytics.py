import sys
from pathlib import Path
import numpy as np

# Inject path agar modul src terbaca
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from services.foreign_analytics import compute_hmm_regime, compute_var_irf, compute_foreign_hhi

def test_hmm_regime_shape():
    """HMM harus mengembalikan list state dan probabilitas sepanjang data input."""
    dummy_flows = np.random.normal(1000, 500, 50).tolist()
    result = compute_hmm_regime(dummy_flows, n_states=3)
    
    assert "states" in result
    assert "probabilities" in result
    assert len(result["states"]) == 50
    assert len(result["probabilities"]) == 50
    assert len(result["probabilities"][0]) == 3 # 3 states

def test_var_irf_computation():
    """VAR IRF harus berhasil mengekstrak efek shock dari foreign ke return."""
    # Dummy data: 50 hari
    dummy_foreign = np.random.normal(5000000, 1000000, 50).tolist()
    dummy_returns = np.random.normal(0, 0.02, 50).tolist()
    
    result = compute_var_irf(dummy_foreign, dummy_returns, lags=2, horizon=5)
    
    assert "foreign_shock_to_ret" in result
    assert len(result["foreign_shock_to_ret"]) == 6 # t=0 sampai t=5

def test_foreign_hhi_logic():
    """HHI dari 2 broker seimbang (50% & 50%) harus menghasilkan 0.5"""
    # 50^2 + 50^2 = 2500 + 2500 = 5000 / 10000 = 0.5
    hhi = compute_foreign_hhi([1000, -1000]) 
    assert np.isclose(hhi, 0.5)
    
    """HHI dari 1 broker mendominasi (100%) harus menghasilkan 1.0"""
    hhi_mono = compute_foreign_hhi([5000, 0])
    assert np.isclose(hhi_mono, 1.0)

