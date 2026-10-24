"""Diagnostic only: compare Yahoo 5-minute candles against the existing Alpaca CSVs.
Does not commit, publish, or archive Yahoo price data.
"""
import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import yfinance as yf

ROOT = Path('public/stocks/intraday')
SYMBOLS = ('SPY', 'QQQ', 'NVDA', 'AMD', 'TSLA')
NY = ZoneInfo('America/New_York')

def regular(dt):
    local = dt.astimezone(NY)
    return local.weekday() < 5 and (9, 30) <= (local.hour, local.minute) < (16, 0)

def read_alpaca(symbol):
    with (ROOT / f'{symbol}.csv').open(newline='') as f:
        return {datetime.fromisoformat(row['time'].replace('Z', '+00:00')): row for row in csv.DictReader(f)}

def main():
    results = []
    for symbol in SYMBOLS:
        try:
            # Yahoo's five-minute window is at most the last 60 calendar days.
            frame = yf.Ticker(symbol).history(period='59d', interval='5m', prepost=False, auto_adjust=False, raise_errors=True)
            if frame.empty:
                raise ValueError('No Yahoo candles returned')
            yahoo = {}
            for stamp, row in frame.iterrows():
                dt = stamp.to_pydatetime().astimezone(timezone.utc)
                if regular(dt) and all(float(row[k]) > 0 for k in ('Open', 'High', 'Low', 'Close')):
                    yahoo[dt] = row
            alpaca = read_alpaca(symbol)
            shared = sorted(set(yahoo) & set(alpaca))
            deltas = [abs(float(yahoo[t]['Close']) - float(alpaca[t]['close'])) / float(alpaca[t]['close']) * 100 for t in shared]
            results.append({'symbol': symbol, 'status': 'ok', 'yahoo_bars': len(yahoo),
                'first_yahoo': min(yahoo).isoformat() if yahoo else None,
                'last_yahoo': max(yahoo).isoformat() if yahoo else None,
                'overlap_bars': len(shared), 'alpaca_only': len(set(alpaca) - set(yahoo)),
                'yahoo_only_in_alpaca_range': sum(min(alpaca) <= t <= max(alpaca) and t not in alpaca for t in yahoo),
                'mean_close_difference_pct': round(sum(deltas) / len(deltas), 5) if deltas else None,
                'max_close_difference_pct': round(max(deltas), 5) if deltas else None})
        except Exception as exc:
            results.append({'symbol': symbol, 'status': 'error', 'message': str(exc)[:240]})
    print(json.dumps({'purpose': 'Diagnostic only, no Yahoo data saved or published', 'results': results}, indent=2))
    if any(r['status'] != 'ok' or r['overlap_bars'] < 50 for r in results):
        raise SystemExit('Diagnostic incomplete; inspect source coverage and failures')

if __name__ == '__main__':
    main()
