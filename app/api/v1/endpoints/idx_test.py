from fastapi import APIRouter
from app.services.idx_api_service import IDXClient

router = APIRouter()

@router.get("/test_all")
async def test_all_idx_endpoints():
    client = IDXClient()
    results = {}
    
    # Gunakan tanggal hari bursa yang pasti ada datanya: 20 Februari 2024
    test_date = "20240220"
    year = 2024
    month = 2

    def test_endpoint(name: str, func):
        try:
            res = func()
            if res is None:
                results[name] = "Failed (Null Response)"
            elif isinstance(res, list):
                results[name] = f"Success: {len(res)} records"
            elif isinstance(res, dict):
                results[name] = "Success: Data received"
            else:
                results[name] = "Success"
        except Exception as e:
            results[name] = f"Error: {str(e)[:100]}"

    # 1. Company Module
    test_endpoint("company.getCompanyProfiles", lambda: client.company.getCompanyProfiles(0, 10))
    test_endpoint("company.getCompanyProfilesDetail", lambda: client.company.getCompanyProfilesDetail("BBCA"))
    test_endpoint("company.getAnnouncements", lambda: client.company.getAnnouncements("BBCA", 10))
    test_endpoint("company.getFinancialRatios", lambda: client.company.getFinancialRatios(year, month))
    test_endpoint("company.getDividendAnnouncements", lambda: client.company.getDividendAnnouncements(year, month))
    test_endpoint("company.getStockSplits", lambda: client.company.getStockSplits(year, month))
    test_endpoint("company.getNewListings", lambda: client.company.getNewListings(year, month))
    test_endpoint("company.getAdditionalListings", lambda: client.company.getAdditionalListings(year, month))
    test_endpoint("company.getDelistings", lambda: client.company.getDelistings(year, month))
    test_endpoint("company.getRightOfferings", lambda: client.company.getRightOfferings(year, month))
    test_endpoint("company.getFinancialReports", lambda: client.company.getFinancialReports("BBCA", year))
    test_endpoint("company.getIssuedHistory", lambda: client.company.getIssuedHistory("BBCA"))
    test_endpoint("company.getProfileAnnouncements", lambda: client.company.getProfileAnnouncements("BBCA"))
    test_endpoint("company.getRelistingData", lambda: client.company.getRelistingData())
    test_endpoint("company.getSecuritiesStock", lambda: client.company.getSecuritiesStock())
    test_endpoint("company.getStockScreener", lambda: client.company.getStockScreener())
    test_endpoint("company.getSuspendData", lambda: client.company.getSuspendData())

    # 2. Market Module
    test_endpoint("market.getCalendar", lambda: client.market.getCalendar(test_date))
    test_endpoint("market.getDailyIndices", lambda: client.market.getDailyIndices(year, month))
    test_endpoint("market.getIndexChart", lambda: client.market.getIndexChart("COMPOSITE", "1Y"))
    test_endpoint("market.getIndexList", lambda: client.market.getIndexList())
    test_endpoint("market.getSectoralMovement", lambda: client.market.getSectoralMovement(year, month))

    # 3. Trading Module
    test_endpoint("trading.getBrokerSummary", lambda: client.trading.getBrokerSummary(test_date, 0, 10))
    test_endpoint("trading.getDomesticTradingSummary", lambda: client.trading.getDomesticTradingSummary(year, month))
    test_endpoint("trading.getForeignTradingSummary", lambda: client.trading.getForeignTradingSummary(year, month))
    test_endpoint("trading.getIndexSummary", lambda: client.trading.getIndexSummary(test_date))
    test_endpoint("trading.getIndustryTradingSummary", lambda: client.trading.getIndustryTradingSummary(year, month))
    test_endpoint("trading.getMostActiveByFrequency", lambda: client.trading.getMostActiveByFrequency(year, month))
    test_endpoint("trading.getMostActiveByValue", lambda: client.trading.getMostActiveByValue(year, month))
    test_endpoint("trading.getMostActiveByVolume", lambda: client.trading.getMostActiveByVolume(year, month))
    test_endpoint("trading.getStockSummary", lambda: client.trading.getStockSummary(test_date))
    test_endpoint("trading.getTopGainers", lambda: client.trading.getTopGainers(year, month))
    test_endpoint("trading.getTopLosers", lambda: client.trading.getTopLosers(year, month))
    test_endpoint("trading.getTradeSummary", lambda: client.trading.getTradeSummary())
    test_endpoint("trading.getTradingInfoDaily", lambda: client.trading.getTradingInfoDaily("BBCA"))
    test_endpoint("trading.getTradingInfoSS", lambda: client.trading.getTradingInfoSS("BBCA", 0, 10))

    # 4. Participants Module
    test_endpoint("participants.getBrokerSearch", lambda: client.participants.getBrokerSearch(0, 10))
    test_endpoint("participants.getParticipantSearch", lambda: client.participants.getParticipantSearch(0, 10))
    test_endpoint("participants.getPrimaryDealerSearch", lambda: client.participants.getPrimaryDealerSearch(0, 10))

    return {
        "status": "Test Completed",
        "results": results
    }
