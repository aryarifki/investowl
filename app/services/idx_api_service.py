import requests
import time
import base64
import json
from typing import Optional, Any

class BaseClient:
    BASE_URL = "https://www.idx.co.id"
    
    def __init__(self):
        self.session = requests.Session()
        self._session_ready = False
        self.headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Referer': 'https://www.idx.co.id/',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        }

    def _ensure_session(self):
        if self._session_ready: return
        try:
            self.session.get(f"{self.BASE_URL}/id", headers=self.headers, timeout=15)
            time.sleep(1)
            self.headers['X-Requested-With'] = 'XMLHttpRequest'
            self.session.get(f"{self.BASE_URL}/primary/home/GetIndexList", headers=self.headers, timeout=15)
            time.sleep(1)
            self._session_ready = True
        except Exception as e:
            raise Exception(f"Gagal inisialisasi sesi IDX: {e}")

    def _fetch(self, endpoint: str, params: dict = None, max_retries: int = 3) -> Optional[Any]:
        self._ensure_session()
        url = f"{self.BASE_URL}{endpoint}"
        
        for attempt in range(max_retries):
            try:
                resp = self.session.get(url, headers=self.headers, params=params, timeout=15)
                
                # Tambahkan logging jika status code bukan 200
                if resp.status_code != 200:
                    print(f"[IDXClient] HTTP {resp.status_code} on {endpoint} | Response: {resp.text[:200]}")
                    resp.raise_for_status()
                    
                return resp.json()
            except Exception:
                if attempt >= max_retries - 1:
                    return None
                delay = min(1000 * (2 ** attempt) / 1000, 15)
                time.sleep(delay)

class CompanyModule:
    def __init__(self, client: BaseClient):
        self.client = client

    def getAdditionalListings(self, year, month, pageSize=10, pageNumber=1):
        params = {"urlName": "LINK_LISTING", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": pageSize, "pageNumber": pageNumber}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getAnnouncements(self, companyCode="", pageSize=9999, indexFrom=0, dateFrom="", dateTo="", language="id"):
        params = {"kodeEmiten": companyCode, "indexFrom": indexFrom, "pageSize": pageSize, "dateFrom": dateFrom, "dateTo": dateTo, "lang": language}
        data = self.client._fetch("/primary/ListedCompany/GetAnnouncement", params)
        return data.get("Replies", []) if data and data.get("Replies") else []

    def getCompanyProfiles(self, start=0, length=9999):
        params = {"start": start, "length": length}
        data = self.client._fetch("/primary/ListedCompany/GetCompanyProfiles", params)
        return data.get("data", []) if data and data.get("data") else []

    def getCompanyProfilesDetail(self, companyCode, language="id-id"):
        params = {"KodeEmiten": companyCode, "language": language}
        data = self.client._fetch("/primary/ListedCompany/GetCompanyProfilesDetail", params)
        if data and data.get("Profiles") and len(data["Profiles"]) > 0:
            return data
        return None

    def getDelistings(self, year, month, pageSize=10, pageNumber=1):
        params = {"urlName": "LINK_DELISTING", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": pageSize, "pageNumber": pageNumber}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getDividendAnnouncements(self, year, month, pageSize=10, pageNumber=1):
        params = {"urlName": "LINK_DIVIDEND", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": pageSize, "pageNumber": pageNumber}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getFinancialRatios(self, year, month):
        params = {"urlName": "LINK_FINANCIAL_DATA_RATIO", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false"}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getFinancialReports(self, companyCode, year, period="audit", indexFrom=0, pageSize=100):
        params = {"periode": period, "year": year, "indexFrom": indexFrom, "pageSize": pageSize, "reportType": "rdf", "kodeEmiten": companyCode}
        data = self.client._fetch("/primary/ListedCompany/GetFinancialReport", params)
        return data.get("Results", []) if data and data.get("Results") else []

    def getIssuedHistory(self, companyCode, start=0, length=9999):
        params = {"kodeEmiten": companyCode, "start": start, "length": length}
        data = self.client._fetch("/primary/ListingActivity/GetIssuedHistory", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getNewListings(self, year, month, pageSize=10, pageNumber=1):
        params = {"urlName": "LINK_STOCK_NEW_LISTING", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": pageSize, "pageNumber": pageNumber}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getProfileAnnouncements(self, companyCode="", indexFrom=0, pageSize=10, dateFrom="", dateTo="", language="id"):
        params = {"KodeEmiten": companyCode, "indexFrom": indexFrom, "pageSize": pageSize, "dateFrom": dateFrom, "dateTo": dateTo, "lang": language}
        data = self.client._fetch("/primary/ListedCompany/GetProfileAnnouncement", params)
        return data.get("Replies", []) if data and data.get("Replies") else []

    def getRelistingData(self, pageSize=9999, indexFrom=0):
        params = {"pageSize": pageSize, "indexFrom": indexFrom}
        data = self.client._fetch("/primary/Home/GetRelistingData", params)
        return data.get("Activities", []) if data and data.get("Activities") else []

    def getRightOfferings(self, year, month, pageSize=10, pageNumber=1):
        params = {"urlName": "LINK_RIGHT_OFFERING", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": pageSize, "pageNumber": pageNumber}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getSecuritiesStock(self, start=0, length=9999, code="", sector="", board=""):
        params = {"start": start, "length": length, "code": code, "sector": sector, "board": board}
        data = self.client._fetch("/primary/StockData/GetSecuritiesStock", params)
        return data.get("data", []) if data and data.get("data") else []

    def getStockScreener(self, sector="", subSector=""):
        params = {"Sector": sector, "SubSector": subSector}
        data = self.client._fetch("/support/stock-screener/api/v1/stock-screener/get", params)
        return data.get("results", []) if data and data.get("results") else []

    def getStockSplits(self, year, month, pageSize=10, pageNumber=1):
        params = {"urlName": "LINK_STOCK_SPLIT", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": pageSize, "pageNumber": pageNumber}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getSuspendData(self, resultCount=9999):
        params = {"resultCount": resultCount}
        data = self.client._fetch("/primary/Home/GetSuspendData", params)
        return data.get("Results", []) if data and data.get("Results") else []

class MarketModule:
    def __init__(self, client: BaseClient):
        self.client = client

    def getCalendar(self, date_str: str):
        params = {"range": "m", "date": date_str}
        data = self.client._fetch("/primary/Home/GetCalendar", params)
        return data.get("Results", []) if data and data.get("Results") else []

    def getDailyIndices(self, year: int, month: int):
        query_obj = {"year": str(year), "month": str(month), "quarter": 0, "type": "monthly"}
        query_base64 = base64.b64encode(json.dumps(query_obj).encode()).decode()
        params = {"urlName": "LINK_DAILY_IDX_INDICES", "query": query_base64, "isPrint": "False", "cumulative": "false"}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiData", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getIndexChart(self, indexCode: str, period: str = "1D"):
        params = {"indexCode": indexCode, "period": period}
        return self.client._fetch("/primary/helper/GetIndexChart", params)

    def getIndexList(self):
        data = self.client._fetch("/primary/home/GetIndexList")
        return data if isinstance(data, list) else []

    def getSectoralMovement(self, year: int, month: int):
        query_obj = {"year": str(year), "month": str(month), "quarter": 0, "type": "monthly"}
        query_base64 = base64.b64encode(json.dumps(query_obj).encode()).decode()
        params = {"urlName": "LINK_DPS_JCI_SECTORAL_MOVEMENT", "query": query_base64, "isPrint": "False", "cumulative": "false"}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiData", params)
        return data if data else None

class TradingModule:
    def __init__(self, client: BaseClient):
        self.client = client

    def getBrokerSummary(self, date_str: str, start=0, length=9999):
        params = {"length": length, "start": start, "date": date_str}
        data = self.client._fetch("/primary/TradingSummary/GetBrokerSummary", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getDomesticTradingSummary(self, year: int, month: int):
        query_obj = {"year": str(year), "month": str(month), "quarter": 0, "type": "monthly"}
        query_base64 = base64.b64encode(json.dumps(query_obj).encode()).decode()
        params = {"urlName": "LINK_TABLE_DAILY_TRADING_INVESTOR_DOMESTIC", "query": query_base64, "isPrint": "False", "cumulative": "false"}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiData", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getForeignTradingSummary(self, year: int, month: int):
        query_obj = {"year": str(year), "month": str(month), "quarter": 0, "type": "monthly"}
        query_base64 = base64.b64encode(json.dumps(query_obj).encode()).decode()
        params = {"urlName": "LINK_TABLE_DAILY_TRADING_INVESTOR_FOREIGN", "query": query_base64, "isPrint": "False", "cumulative": "false"}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiData", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getIndexSummary(self, date_str: str, start=0, length=9999):
        params = {"lang": "id", "date": date_str, "start": start, "length": length}
        data = self.client._fetch("/primary/TradingSummary/GetIndexSummary", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getIndustryTradingSummary(self, year: int, month: int):
        query_obj = {"year": str(year), "month": str(month), "quarter": 0, "type": "monthly"}
        query_base64 = base64.b64encode(json.dumps(query_obj).encode()).decode()
        params = {"urlName": "LINK_LIST_TRADING_SUMMARY_INDUSTRY_CLASSIFICATION", "query": query_base64, "isPrint": "False", "cumulative": "false"}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiData", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getMostActiveByFrequency(self, year: int, month: int):
        # Tambahkan pageSize & pageNumber karena IDX butuh parameter paginasi agar tidak 500
        params = {"urlName": "LINK_MOST_ACTIVE_STOCK_FREQ", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": 20, "pageNumber": 1}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data if data else None

    def getMostActiveByValue(self, year: int, month: int):
        params = {"urlName": "LINK_MOST_ACTIVE_STOCK_VALUE", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": 20, "pageNumber": 1}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data if data else None

    def getMostActiveByVolume(self, year: int, month: int):
        params = {"urlName": "LINK_MOST_ACTIVE_STOCK_VOLUME", "periodYear": year, "periodMonth": month, "periodType": "monthly", "isPrint": "False", "cumulative": "false", "pageSize": 20, "pageNumber": 1}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiDataPaginated", params)
        return data if data else None

    def getStockSummary(self, date_str: str):
        params = {"date": date_str}
        data = self.client._fetch("/primary/TradingSummary/GetStockSummary", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getTopGainers(self, year: int, month: int):
        query_obj = {"year": str(year), "month": str(month), "quarter": 0, "type": "monthly"}
        query_base64 = base64.b64encode(json.dumps(query_obj).encode()).decode()
        params = {"urlName": "LINK_TOP_GAINER", "query": query_base64, "isPrint": "False", "cumulative": "false"}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiData", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getTopLosers(self, year: int, month: int):
        query_obj = {"year": str(year), "month": str(month), "quarter": 0, "type": "monthly"}
        query_base64 = base64.b64encode(json.dumps(query_obj).encode()).decode()
        params = {"urlName": "LINK_TOP_LOSER", "query": query_base64, "isPrint": "False", "cumulative": "false"}
        data = self.client._fetch("/primary/DigitalStatistic/GetApiData", params)
        return data.get("data", []) if data and isinstance(data.get("data"), list) else []

    def getTradeSummary(self):
        data = self.client._fetch("/primary/Home/GetTradeSummary", {"lang": "id"})
        return data if isinstance(data, list) else []

    def getTradingInfoDaily(self, companyCode: str):
        params = {"code": companyCode}
        return self.client._fetch("/primary/ListedCompany/GetTradingInfoDaily", params)

    def getTradingInfoSS(self, companyCode: str, start=0, length=1000):
        params = {"code": companyCode, "start": start, "length": length}
        data = self.client._fetch("/primary/ListedCompany/GetTradingInfoSS", params)
        return data.get("replies", []) if data and data.get("replies") else []

class ParticipantsModule:
    def __init__(self, client: BaseClient):
        self.client = client

    def getBrokerSearch(self, start=0, length=9999):
        params = {"start": start, "length": length}
        data = self.client._fetch("/primary/ExchangeMember/GetBrokerSearch", params)
        if data and isinstance(data.get("data"), list):
            return data["data"][:length]
        return []

    def getParticipantSearch(self, start=0, length=9999, codeOrName="", license=""):
        params = {"start": start, "length": length, "codeName": codeOrName, "license": license}
        data = self.client._fetch("/primary/ExchangeMember/GetParticipantSearch", params)
        return data if data else None

    def getPrimaryDealerSearch(self, start=0, length=9999, codeOrName="", license=""):
        params = {"start": start, "length": length, "codeName": codeOrName, "license": license}
        data = self.client._fetch("/primary/ExchangeMember/GetPrimaryDealerSearch", params)
        return data if data else None

class IDXClient(BaseClient):
    def __init__(self):
        super().__init__()
        self.company = CompanyModule(self)
        self.market = MarketModule(self)
        self.trading = TradingModule(self)
        self.participants = ParticipantsModule(self)
