import sys
import json
import urllib.request
import os
from dotenv import load_dotenv

load_dotenv('d:/antigravity/stock_analiz/.env')
api_key = os.environ.get('FMP_API_KEY')

if not api_key:
    print("No API key")
    sys.exit(1)

urls = [
    f"https://financialmodelingprep.com/stable/historical-chart/15min?symbol=AAPL&apikey={api_key}",
    f"https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=AAPL&apikey={api_key}"
]

for url in urls:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"URL: {url}")
            if isinstance(data, list):
                if len(data) > 0:
                    print(f"  First element: {data[0]}")
                    print(f"  Last element: {data[-1]}")
            elif isinstance(data, dict):
                hist = data.get('historical', [])
                if len(hist) > 0:
                     print(f"  Dict historical length: {len(hist)}")
                     print(f"  First element: {hist[0]}")
                     print(f"  Last element: {hist[-1]}")
    except Exception as e:
        print(f"Error fetching {url}: {e}")
