---
name: reading-excel-files
description: Use when inspecting, querying, extracting, or summarizing Excel spreadsheets (.xlsx, .xls, .csv) or tabular data files without blowing up context window.
---

# Reading Excel Files

## Overview
A lightweight, context-efficient reference and utility pattern for agents to inspect, query, search, and export Excel workbooks (`.xlsx`, `.xls`, `.csv`) safely, including zero-dependency environments and Windows console encoding support.

## When to Use
- User provides or references a spreadsheet (`.xlsx`, `.xls`, `.csv`) to read, summarize, or analyze
- User asks to find specific rows, data values, or sheet names in an Excel file
- Needing to extract structured data from binary Office Open XML documents without crashing or overflowing context

**When NOT to use:**
- Simple plain-text `.csv` files under 100 lines (use normal text reading tools)
- Non-tabular Office files (Word `.docx`, PowerPoint `.pptx` - use dedicated document skills)

## Quick Reference

The companion script `scripts/read_excel.py` requires zero external packages (runs on standard Python 3 `zipfile` + `xml.etree`):

| Goal | Command |
|---|---|
| **Inspect Sheets & Row Counts** | `py -3 scripts/read_excel.py info "<path_to_excel>"` |
| **Preview First N Rows** | `py -3 scripts/read_excel.py preview "<path_to_excel>" --rows 30` |
| **Search by Keyword** | `py -3 scripts/read_excel.py search "<path_to_excel>" "<keyword>"` |
| **Export Sheet to CSV** | `py -3 scripts/read_excel.py export "<path_to_excel>" -o output.csv` |

*(Note: On Windows, use `py -3` or `python3.11` to avoid WindowsApps stub redirection).*

## Core Principles

### 1. Schema-First Inspection (Avoid Context Explosions)
Never dump an entire unknown spreadsheet directly into the prompt context. Spreadsheets can have tens of thousands of rows.
1. Run `info` first to discover sheet names, sheet count, and non-empty row counts.
2. Preview the first 10-30 rows to understand the column header mapping and layout.
3. Query or export only the relevant sheet or subset needed.

### 2. Windows UTF-8 & Console Encoding
On Windows environments, stdout defaults to `cp1252` or `cp437`. Printing non-ASCII characters (Vietnamese, Japanese, accents) will crash with `UnicodeEncodeError: 'charmap' codec can't encode character`.
Always ensure:
```python
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
```

### 3. Zero-Dependency XLSX Extraction
If `openpyxl` or `pandas` are not installed, remember that `.xlsx` is a ZIP archive containing XML:
- `xl/workbook.xml` contains sheet names and IDs.
- `xl/sharedStrings.xml` contains text cell strings (indexed by `t="s"`).
- `xl/worksheets/sheet<N>.xml` contains row and cell values `<c r="A1"><v>0</v></c>`.
Using Python's standard `zipfile` and `xml.etree.ElementTree` allows 100% reliable extraction on any machine without `pip install`.

## Fallback Quick-Code (Direct One-Liner)

If running directly in an interactive Python shell with `pandas`:
```python
import pandas as pd
excel = pd.ExcelFile("path/to/file.xlsx")
print("Sheets:", excel.sheet_names)
df = excel.parse(excel.sheet_names[0])
print(df.head(15))
```

Or with `openpyxl`:
```python
import openpyxl
wb = openpyxl.load_workbook("path/to/file.xlsx", data_only=True)
sheet = wb.active
for row in list(sheet.iter_rows(values_only=True))[:20]:
    if any(row):
        print(row)
```

## Common Mistakes & Red Flags

| Mistake | Why it fails | Correct Action |
|---|---|---|
| Calling `view_file` on `.xlsx` | `.xlsx` is a binary ZIP archive, not text | Use Python or `scripts/read_excel.py` |
| Running `python` on Windows without check | Windows 10/11 often redirects `python` to Microsoft Store | Use `py -3` or locate explicit `python3.11.exe` |
| Printing full table without row limit | Can dump 50,000 tokens, blowing context window | Always limit preview to 20-50 rows |
| Ignoring `data_only=True` in openpyxl | Formulas return `=SUM(...)` instead of evaluated numbers | Set `data_only=True` when loading workbook |
| Assuming row 1 is always the header | Excel sheets often have title banners on rows 1-3 | Inspect first 5 rows to locate actual column headers |
