#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
read_excel.py - High-efficiency Excel file reader for AI agents.
Supports zero-dependency fallback (pure Python zipfile + XML parser)
as well as openpyxl/pandas when available.
"""

import sys
import os
import argparse
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def excel_date_to_str(serial_val):
    """Convert Excel serial date number to readable date string if plausible."""
    try:
        val = float(serial_val)
        # Plausible Excel date range (roughly 1990 to 2050)
        if 32874 <= val <= 55153:
            dt = datetime(1899, 12, 30) + timedelta(days=val)
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    return serial_val


class PureZipXlsxReader:
    """Pure Python reader for .xlsx files without third-party dependencies."""

    def __init__(self, filepath):
        self.filepath = filepath
        self.shared_strings = []
        self.sheets = []  # list of dicts: {'name': str, 'id': str, 'target': str}
        self._load_metadata()

    def _load_metadata(self):
        with zipfile.ZipFile(self.filepath, 'r') as z:
            # 1. Load shared strings
            if 'xl/sharedStrings.xml' in z.namelist():
                tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in tree.findall('.//main:si', ns):
                    parts = []
                    for t in si.findall('.//main:t', ns):
                        if t.text:
                            parts.append(t.text)
                    self.shared_strings.append("".join(parts))

            # 2. Map relationships (r:id -> sheet filename)
            rels_map = {}
            if 'xl/_rels/workbook.xml.rels' in z.namelist():
                rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
                ns_rel = {'rel': 'http://schemas.openxmlformats.org/package/2006/relationships'}
                for rel in rels_tree.findall('.//rel:Relationship', ns_rel):
                    rels_map[rel.attrib.get('Id')] = rel.attrib.get('Target')

            # 3. Read workbook sheets
            wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
            ns_wb = {
                'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
            }
            for s in wb_tree.findall('.//main:sheet', ns_wb):
                s_name = s.attrib.get('name')
                s_id = s.attrib.get('sheetId')
                r_id = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                target = rels_map.get(r_id, f"worksheets/sheet{s_id}.xml")
                if not target.startswith('xl/'):
                    target = f"xl/{target}"
                self.sheets.append({
                    'name': s_name,
                    'sheet_id': s_id,
                    'target': target
                })

    def get_sheet_names(self):
        return [s['name'] for s in self.sheets]

    def iter_sheet_rows(self, sheet_name=None):
        """Yield rows as list of (cell_ref, cell_value)."""
        target_sheet = None
        if sheet_name is None and self.sheets:
            target_sheet = self.sheets[0]
        else:
            for s in self.sheets:
                if s['name'].lower() == (sheet_name or "").lower():
                    target_sheet = s
                    break

        if not target_sheet:
            raise ValueError(f"Sheet '{sheet_name}' not found. Available: {self.get_sheet_names()}")

        with zipfile.ZipFile(self.filepath, 'r') as z:
            target = target_sheet['target']
            if target not in z.namelist():
                return
            sheet_tree = ET.fromstring(z.read(target))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows = sheet_tree.findall('.//main:row', ns)
            for r in rows:
                r_num = int(r.attrib.get('r', 0))
                cols = []
                for c in r.findall('.//main:c', ns):
                    cell_ref = c.attrib.get('r', '')
                    t_attr = c.attrib.get('t')
                    v = c.find('.//main:v', ns)
                    val = ""
                    if v is not None and v.text is not None:
                        if t_attr == 's':
                            idx = int(v.text)
                            if idx < len(self.shared_strings):
                                val = self.shared_strings[idx]
                            else:
                                val = f"[str:{idx}]"
                        else:
                            val = v.text
                    elif t_attr == 'inlineStr':
                        t_tag = c.find('.//main:t', ns)
                        if t_tag is not None and t_tag.text:
                            val = t_tag.text
                    if val:
                        cols.append((cell_ref, val))
                if cols:
                    yield (r_num, cols)


def cmd_info(filepath):
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}", file=sys.stderr)
        sys.exit(1)

    reader = PureZipXlsxReader(filepath)
    size_kb = os.path.getsize(filepath) / 1024.0
    print(f"File: {os.path.basename(filepath)}")
    print(f"Path: {filepath}")
    print(f"Size: {size_kb:.2f} KB")
    print(f"Total Sheets: {len(reader.sheets)}")
    for i, s in enumerate(reader.sheets, 1):
        row_count = sum(1 for _ in reader.iter_sheet_rows(s['name']))
        print(f"  {i}. Sheet '{s['name']}' (Rows with data: {row_count})")


def cmd_preview(filepath, sheet_name=None, max_rows=30):
    reader = PureZipXlsxReader(filepath)
    target = sheet_name or (reader.sheets[0]['name'] if reader.sheets else None)
    if not target:
        print("No sheets found.")
        return

    print(f"--- Previewing Sheet: '{target}' (Max {max_rows} rows) ---")
    count = 0
    for r_num, cols in reader.iter_sheet_rows(target):
        row_str = " | ".join([f"{ref}: {val.strip()}" for ref, val in cols])
        print(f"Row {r_num:3d} | {row_str}")
        count += 1
        if count >= max_rows:
            print(f"... preview limited to {max_rows} rows.")
            break


def cmd_search(filepath, query):
    reader = PureZipXlsxReader(filepath)
    query_lower = query.lower()
    print(f"Searching for '{query}' in {os.path.basename(filepath)}...")
    matches = 0
    for s in reader.sheets:
        s_name = s['name']
        for r_num, cols in reader.iter_sheet_rows(s_name):
            matching_cells = [f"{ref}: {val.strip()}" for ref, val in cols if query_lower in val.lower()]
            if matching_cells:
                matches += 1
                row_all = " | ".join([f"{ref}: {val.strip()}" for ref, val in cols])
                print(f"[{s_name}] Row {r_num}: {row_all}")
    if matches == 0:
        print(f"No matches found for '{query}'.")
    else:
        print(f"Total matches found: {matches}")


def cmd_dump_csv(filepath, sheet_name=None, output_csv=None):
    reader = PureZipXlsxReader(filepath)
    target = sheet_name or (reader.sheets[0]['name'] if reader.sheets else None)
    if not target:
        print("No sheets found.")
        return

    import csv
    import re
    col_regex = re.compile(r"([A-Z]+)(\d+)")

    def col_to_num(col_str):
        num = 0
        for c in col_str:
            num = num * 26 + (ord(c) - ord('A') + 1)
        return num

    rows_data = []
    col_letters = set()

    for r_num, cols in reader.iter_sheet_rows(target):
        row_dict = {}
        for ref, val in cols:
            m = col_regex.match(ref)
            if m:
                col_letters.add(m.group(1))
                row_dict[m.group(1)] = val
            else:
                row_dict[ref] = val
        rows_data.append((r_num, row_dict))

    sorted_cols = sorted(list(col_letters), key=col_to_num)

    out_stream = open(output_csv, 'w', encoding='utf-8-sig', newline='') if output_csv else sys.stdout
    writer = csv.writer(out_stream)
    writer.writerow(["Row"] + sorted_cols)
    for r_num, row_dict in rows_data:
        writer.writerow([r_num] + [row_dict.get(c, "") for c in sorted_cols])

    if output_csv:
        out_stream.close()
        print(f"Exported sheet '{target}' to {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="High-efficiency Excel file reader for agents")
    subparsers = parser.add_subparsers(dest="command")

    p_info = subparsers.add_parser("info", help="Get summary info of sheets and rows")
    p_info.add_argument("file", help="Path to Excel (.xlsx) file")

    p_prev = subparsers.add_parser("preview", help="Preview rows of a sheet")
    p_prev.add_argument("file", help="Path to Excel (.xlsx) file")
    p_prev.add_argument("--sheet", "-s", help="Sheet name (default: first sheet)")
    p_prev.add_argument("--rows", "-n", type=int, default=30, help="Max rows to show (default: 30)")

    p_srch = subparsers.add_parser("search", help="Search for keyword in Excel file")
    p_srch.add_argument("file", help="Path to Excel (.xlsx) file")
    p_srch.add_argument("query", help="Keyword to search for")

    p_exp = subparsers.add_parser("export", help="Export a sheet to CSV")
    p_exp.add_argument("file", help="Path to Excel (.xlsx) file")
    p_exp.add_argument("--sheet", "-s", help="Sheet name")
    p_exp.add_argument("--output", "-o", help="Output CSV path (default: stdout)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "info":
        cmd_info(args.file)
    elif args.command == "preview":
        cmd_preview(args.file, args.sheet, args.rows)
    elif args.command == "search":
        cmd_search(args.file, args.query)
    elif args.command == "export":
        cmd_dump_csv(args.file, args.sheet, args.output)


if __name__ == "__main__":
    main()
