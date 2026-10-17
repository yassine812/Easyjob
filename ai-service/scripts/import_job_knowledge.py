"""Explicit, build-time O*NET import. Runtime drafting never accesses the network."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1] / 'app' / 'job_drafting' / 'data'
VERSION = '31.0'
# Broader source occupations support curated EasyJob specializations; they are not equivalent titles.
CODES = {'15-1252.00', '15-1254.00', '15-1255.00', '15-1244.00', '15-1241.00',
         '15-1253.00', '15-2051.00', '15-2051.01', '15-1243.01', '11-2021.00',
         '41-3091.00', '13-1161.00', '13-1071.00', '13-2051.00', '43-4051.00'}
TABLES = ['occupation_data', 'task_statements', 'sample_of_reported_titles', 'knowledge', 'software_skills', 'related_occupations']

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    result = {'version': VERSION, 'source': 'O*NET 31.0 Database', 'license': 'https://creativecommons.org/licenses/by/4.0/', 'tables': {}, 'downloads': {}}
    for table in TABLES:
        url = f'https://www.onetcenter.org/dl_files/database/db_31_0_json/{table}.json'
        with urlopen(url, timeout=90) as response:
            payload = response.read()
        data = json.loads(payload)
        rows = [row for row in data['row'] if row.get('onetsoc_code') in CODES]
        result['tables'][table] = rows
        result['downloads'][table] = {'url': url, 'sha256': hashlib.sha256(payload).hexdigest(), 'retained_rows': len(rows)}
        print(table, len(rows))
    found = {row['onetsoc_code'] for row in result['tables']['occupation_data']}
    if found != CODES:
        raise ValueError(f'Unknown source codes: {CODES - found}')
    (ROOT / 'onet-31.0.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
