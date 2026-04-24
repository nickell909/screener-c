#!/usr/bin/env python3
"""Generate StatArb Screener project documentation PDF."""

import os
import sys

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
    SimpleDocTemplate, CondPageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━ Color Palette ━━
ACCENT       = colors.HexColor('#197999')
TEXT_PRIMARY  = colors.HexColor('#1c1e1f')
TEXT_MUTED    = colors.HexColor('#7b8388')
BG_SURFACE   = colors.HexColor('#e2e6e8')
BG_PAGE      = colors.HexColor('#eceeef')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSCBold', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('CarlitoBold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansBold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuMono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('Carlito', normal='Carlito', bold='CarlitoBold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSansBold')
registerFontFamily('SarasaMonoSC', normal='SarasaMonoSC', bold='SarasaMonoSCBold')

# ━━ Page Setup ━━
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ━━ Styles ━━
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle', fontName='Carlito', fontSize=28, leading=34,
    alignment=TA_CENTER, textColor=ACCENT, spaceAfter=6
)
subtitle_style = ParagraphStyle(
    'DocSubtitle', fontName='Carlito', fontSize=14, leading=20,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceAfter=24
)
h1_style = ParagraphStyle(
    'H1', fontName='Carlito', fontSize=20, leading=26,
    textColor=ACCENT, spaceBefore=18, spaceAfter=10
)
h2_style = ParagraphStyle(
    'H2', fontName='Carlito', fontSize=15, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8
)
h3_style = ParagraphStyle(
    'H3', fontName='Carlito', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6
)
body_style = ParagraphStyle(
    'Body', fontName='Carlito', fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6,
    firstLineIndent=0
)
body_indent_style = ParagraphStyle(
    'BodyIndent', fontName='Carlito', fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=4,
    leftIndent=20
)
code_style = ParagraphStyle(
    'Code', fontName='DejaVuSans', fontSize=9, leading=14,
    alignment=TA_LEFT, textColor=colors.HexColor('#2d2d2d'),
    backColor=colors.HexColor('#f4f4f4'),
    leftIndent=12, rightIndent=12, spaceBefore=4, spaceAfter=4,
    borderPadding=6
)
bullet_style = ParagraphStyle(
    'Bullet', fontName='Carlito', fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=3,
    leftIndent=24, bulletIndent=12
)
table_header_style = ParagraphStyle(
    'TableHeader', fontName='Carlito', fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=TABLE_HEADER_TEXT
)
table_cell_style = ParagraphStyle(
    'TableCell', fontName='Carlito', fontSize=9.5, leading=14,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY
)
table_cell_center_style = ParagraphStyle(
    'TableCellCenter', fontName='Carlito', fontSize=9.5, leading=14,
    alignment=TA_CENTER, textColor=TEXT_PRIMARY
)
caption_style = ParagraphStyle(
    'Caption', fontName='Carlito', fontSize=9, leading=13,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceAfter=12
)
footer_style = ParagraphStyle(
    'Footer', fontName='Carlito', fontSize=8, leading=10,
    alignment=TA_CENTER, textColor=TEXT_MUTED
)

# ━━ Helper Functions ━━
def heading1(text):
    return Paragraph(f'<b>{text}</b>', h1_style)

def heading2(text):
    return Paragraph(f'<b>{text}</b>', h2_style)

def heading3(text):
    return Paragraph(f'<b>{text}</b>', h3_style)

def body(text):
    return Paragraph(text, body_style)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', bullet_style)

def code(text):
    return Paragraph(text.replace('<', '&lt;').replace('>', '&gt;'), code_style)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BG_SURFACE, spaceAfter=8, spaceBefore=8)

def make_table(headers, rows, col_widths=None):
    """Create a styled table with header and alternating row colors."""
    data = [[Paragraph(f'<b>{h}</b>', table_header_style) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), table_cell_style) for c in row])

    if col_widths is None:
        col_widths = [CONTENT_W / len(headers)] * len(headers)

    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def add_page_number(canvas, doc):
    """Add page number and footer to each page."""
    canvas.saveState()
    canvas.setFont('Carlito', 8)
    canvas.setFillColor(TEXT_MUTED)
    page_num = canvas.getPageNumber()
    canvas.drawCentredString(PAGE_W / 2, 0.5 * inch, f"- {page_num} -")
    canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 0.5 * inch, "StatArb Screener")
    canvas.restoreState()

# ━━ Build Document ━━
output_path = '/home/z/my-project/download/StatArb_Screener_Documentation.pdf'

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN,
)

story = []

# ════════════════════════════════════════════
# TITLE PAGE
# ════════════════════════════════════════════
story.append(Spacer(1, 2.5 * inch))
story.append(Paragraph('<b>StatArb Screener</b>', title_style))
story.append(Spacer(1, 12))
story.append(Paragraph('Statistical Arbitrage, Pairs Trading &amp; Basket Trading Terminal', subtitle_style))
story.append(Spacer(1, 24))
story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, spaceAfter=24, spaceBefore=0))
story.append(Spacer(1, 12))
story.append(Paragraph('Project Documentation', ParagraphStyle(
    'SubInfo', fontName='Carlito', fontSize=12, leading=16,
    alignment=TA_CENTER, textColor=TEXT_MUTED
)))
story.append(Spacer(1, 8))
story.append(Paragraph('Version 1.0', ParagraphStyle(
    'Version', fontName='Carlito', fontSize=11, leading=14,
    alignment=TA_CENTER, textColor=TEXT_MUTED
)))
story.append(Spacer(1, 8))
story.append(Paragraph('April 2026', ParagraphStyle(
    'Date', fontName='Carlito', fontSize=11, leading=14,
    alignment=TA_CENTER, textColor=TEXT_MUTED
)))

story.append(PageBreak())

# ════════════════════════════════════════════
# TABLE OF CONTENTS
# ════════════════════════════════════════════
story.append(Paragraph('<b>Table of Contents</b>', h1_style))
story.append(Spacer(1, 12))

toc_items = [
    ("1.", "Project Overview"),
    ("2.", "System Requirements"),
    ("3.", "Installation &amp; Deployment"),
    ("4.", "Project Structure"),
    ("5.", "Architecture &amp; Data Flow"),
    ("6.", "Statistical Engine"),
    ("7.", "API Reference"),
    ("8.", "Frontend Components"),
    ("9.", "Database Schema"),
    ("10.", "Configuration"),
    ("11.", "Troubleshooting"),
]

for num, title in toc_items:
    story.append(Paragraph(
        f'<b>{num}</b>  {title}',
        ParagraphStyle('TOCItem', fontName='Carlito', fontSize=11, leading=20,
                       leftIndent=20, textColor=TEXT_PRIMARY)
    ))

story.append(PageBreak())

# ════════════════════════════════════════════
# 1. PROJECT OVERVIEW
# ════════════════════════════════════════════
story.append(heading1('1. Project Overview'))

story.append(body(
    '<b>StatArb Screener</b> is a professional-grade web application designed for statistical arbitrage, '
    'pairs trading, and basket trading on the Bybit cryptocurrency exchange. The application provides '
    'real-time cointegration analysis, spread monitoring, and synthetic instrument construction, enabling '
    'traders to identify and exploit mean-reverting relationships between cryptocurrency instruments.'
))

story.append(heading2('1.1 Key Features'))

story.append(bullet(
    '<b>Cointegration Screener</b> — Batch scan of linear perpetual contracts on Bybit to discover '
    'cointegrated pairs using the Engle-Granger two-step method with ADF test. Results are sorted by '
    'p-value and include hedge ratio, half-life, and correlation metrics.'
))
story.append(bullet(
    '<b>Synthetic Instruments</b> — Create, save, and manage synthetic instruments composed of multiple '
    'legs with configurable coefficients and sides (long/short). Supports both pair (2 legs) and '
    'basket (3+ legs) configurations.'
))
story.append(bullet(
    '<b>Interactive Charts</b> — TradingView-style charts powered by lightweight-charts v5 with pan, zoom, '
    'crosshair, and multi-pane layouts. Displays spread lines, Bollinger Bands, Z-Score in separate panes, '
    'and volume histograms with all Bybit timeframes (1m to 1M).'
))
story.append(bullet(
    '<b>Real-Time Data</b> — Direct integration with Bybit V5 public API. No API keys required. '
    'In-memory caching for instruments (5 min) and klines (1 min) reduces API load.'
))
story.append(bullet(
    '<b>Local Deployment</b> — Runs entirely locally with SQLite database for persistence. '
    'No external services, no accounts, no cloud dependencies.'
))

story.append(heading2('1.2 Technology Stack'))

story.append(make_table(
    ['Layer', 'Technology', 'Version'],
    [
        ['Frontend', 'React + Next.js', '19.0 / 16.1'],
        ['Charting', 'lightweight-charts (TradingView)', '5.1.0'],
        ['UI Components', 'shadcn/ui + Radix + Tailwind CSS', '4.0'],
        ['State Management', 'Zustand', '5.0.6'],
        ['Data Fetching', 'TanStack React Query', '5.82.0'],
        ['Backend', 'Next.js API Routes (Serverless)', '16.1'],
        ['Database', 'SQLite via Prisma ORM', '6.11.1'],
        ['Statistics', 'Custom (OLS, ADF, Engle-Granger)', 'N/A'],
        ['Exchange API', 'Bybit V5 Public Endpoints', 'N/A'],
        ['Runtime', 'Bun (recommended) / Node.js', '1.3+ / 24+'],
    ],
    col_widths=[CONTENT_W * 0.22, CONTENT_W * 0.50, CONTENT_W * 0.28]
))

story.append(Spacer(1, 12))

# ════════════════════════════════════════════
# 2. SYSTEM REQUIREMENTS
# ════════════════════════════════════════════
story.append(heading1('2. System Requirements'))

story.append(heading2('2.1 Hardware Requirements'))

story.append(body(
    'The application is lightweight and can run on minimal hardware. Since all statistical computations '
    'are performed server-side in the API routes, the primary constraint is memory for caching API responses '
    'and the Node.js/Bun runtime. A machine with 1 GB RAM and a single CPU core is sufficient for personal use.'
))

story.append(make_table(
    ['Resource', 'Minimum', 'Recommended'],
    [
        ['CPU', '1 core', '2+ cores'],
        ['RAM', '512 MB', '1 GB+'],
        ['Disk', '100 MB', '500 MB (including node_modules)'],
        ['Network', 'Stable internet for Bybit API', 'Low latency connection preferred'],
    ],
    col_widths=[CONTENT_W * 0.25, CONTENT_W * 0.375, CONTENT_W * 0.375]
))

story.append(Spacer(1, 8))

story.append(heading2('2.2 Software Requirements'))

story.append(make_table(
    ['Software', 'Version', 'Purpose'],
    [
        ['Bun', '1.3+', 'Primary runtime and package manager'],
        ['Node.js', '24+', 'Alternative runtime (Bun preferred)'],
        ['Git', '2.0+', 'Source code version control'],
    ],
    col_widths=[CONTENT_W * 0.25, CONTENT_W * 0.2, CONTENT_W * 0.55]
))

story.append(Spacer(1, 8))

story.append(body(
    '<b>Note:</b> Bun is the recommended runtime because it offers faster startup times and native TypeScript '
    'execution. Node.js works as a fallback but requires additional configuration for TypeScript compilation. '
    'The project has been tested with Bun 1.3.12 and Node.js 24.14.1.'
))

# ════════════════════════════════════════════
# 3. INSTALLATION & DEPLOYMENT
# ════════════════════════════════════════════
story.append(heading1('3. Installation &amp; Deployment'))

story.append(heading2('3.1 Quick Start'))

story.append(body(
    'Follow these steps to get the application running locally. The entire process takes under 5 minutes '
    'on a machine with a stable internet connection. No API keys or accounts are needed — the application '
    'uses Bybit public market data endpoints which do not require authentication.'
))

story.append(heading3('Step 1: Install Bun'))
story.append(code('curl -fsSL https://bun.sh/install | bash'))

story.append(heading3('Step 2: Clone or Extract the Project'))
story.append(code('cd /path/to/project    # navigate to the project directory'))

story.append(heading3('Step 3: Install Dependencies'))
story.append(code('bun install'))

story.append(heading3('Step 4: Initialize Database'))
story.append(code('bun run db:generate    # generate Prisma client\nbun run db:push        # create SQLite tables'))

story.append(heading3('Step 5: Start Development Server'))
story.append(code('bun run dev            # starts on http://localhost:3000'))

story.append(Spacer(1, 8))

story.append(body(
    'The application will be available at <b>http://localhost:3000</b>. The first load may take a few seconds '
    'as Next.js compiles the pages. You should see the "Bybit Connected" badge in the top-right corner, '
    'confirming that the API connection is working.'
))

story.append(heading2('3.2 Production Build'))

story.append(body(
    'For production deployment, build the standalone output and run it directly. The standalone output '
    'includes a minimal server that does not require the full node_modules directory, resulting in '
    'significantly smaller deployment size. This is the recommended approach for VPS or container deployment.'
))

story.append(code('bun run build          # creates .next/standalone/ output\nbun run start          # runs standalone server on port 3000'))

story.append(Spacer(1, 8))

story.append(body(
    'The production build uses Next.js standalone output mode, which bundles only the necessary '
    'dependencies into a self-contained server. The database file at <b>db/custom.db</b> must be '
    'accessible at the path specified in the DATABASE_URL environment variable. The environment variable '
    'must be set before starting the production server.'
))

story.append(heading2('3.3 Docker Deployment (Optional)'))

story.append(body(
    'For containerized deployment, you can create a Dockerfile based on the standalone output. '
    'The following Dockerfile provides a minimal production image. Note that the DATABASE_URL '
    'must point to a mounted volume for data persistence across container restarts.'
))

story.append(code(
    'FROM oven/bun:1\n'
    'WORKDIR /app\n'
    'COPY .next/standalone ./\n'
    'COPY .next/static ./.next/static\n'
    'COPY public ./public\n'
    'COPY db ./db\n'
    'ENV DATABASE_URL=file:/app/db/custom.db\n'
    'EXPOSE 3000\n'
    'CMD ["bun", "server.js"]'
))

story.append(heading2('3.4 Reverse Proxy'))

story.append(body(
    'If you need to expose the application on a different port or with HTTPS, use a reverse proxy such as '
    'Caddy or Nginx. The project includes a Caddyfile that proxies port 81 to the Next.js server on port 3000. '
    'Caddy automatically handles HTTPS certificate provisioning via Let\'s Encrypt for domains with proper DNS configuration.'
))

story.append(code(
    '# Caddyfile example\n'
    ':81 {\n'
    '    reverse_proxy localhost:3000\n'
    '}'
))

# ════════════════════════════════════════════
# 4. PROJECT STRUCTURE
# ════════════════════════════════════════════
story.append(heading1('4. Project Structure'))

story.append(body(
    'The project follows the standard Next.js App Router structure with TypeScript. The source code is '
    'organized into four main directories under src/: app (API routes and pages), components (UI panels), '
    'lib (business logic and utilities), and store (Zustand state management). Each module has a clear '
    'responsibility boundary, making the codebase easy to navigate and extend.'
))

story.append(make_table(
    ['Path', 'Description'],
    [
        ['src/app/api/', 'API route handlers (7 endpoints)'],
        ['src/app/api/bybit/', 'Bybit data proxies (instruments, klines)'],
        ['src/app/api/cointegration/', 'Batch cointegration scan'],
        ['src/app/api/pair-chart/', 'Pair spread/Z-score/BB data'],
        ['src/app/api/synthetics/', 'CRUD for synthetic instruments + chart'],
        ['src/components/chart/', 'ChartPanel - TradingView charts'],
        ['src/components/screener/', 'ScreenerPanel - scan &amp; results'],
        ['src/components/synthetics/', 'SyntheticsPanel - builder &amp; list'],
        ['src/components/ui/', 'shadcn/ui components (40+)'],
        ['src/lib/bybit.ts', 'Bybit V5 API client'],
        ['src/lib/cointegration.ts', 'Statistical engine (527 lines)'],
        ['src/lib/normalization.ts', 'Data alignment &amp; normalization'],
        ['src/lib/synthetic.ts', 'Synthetic instrument math'],
        ['src/lib/db.ts', 'Prisma client singleton'],
        ['src/store/', 'Zustand stores (screener, synthetic)'],
        ['prisma/schema.prisma', 'Database schema definition'],
        ['db/custom.db', 'SQLite database file'],
    ],
    col_widths=[CONTENT_W * 0.40, CONTENT_W * 0.60]
))

story.append(Spacer(1, 8))

# ════════════════════════════════════════════
# 5. ARCHITECTURE & DATA FLOW
# ════════════════════════════════════════════
story.append(heading1('5. Architecture &amp; Data Flow'))

story.append(body(
    'The application follows a server-rendered SPA architecture where Next.js API routes act as a '
    'middleware layer between the frontend and the Bybit exchange API. All market data flows through '
    'the server, which adds caching, computation, and normalization. The statistical engine runs '
    'entirely on the server, keeping computation off the client and enabling efficient batch processing.'
))

story.append(heading2('5.1 Data Flow Diagram'))

story.append(body(
    'The following diagram illustrates the primary data flow from the Bybit exchange through the server '
    'to the frontend components. Each arrow represents an HTTP request or data transformation step.'
))

flow_data = [
    [Paragraph('<b>Stage</b>', table_header_style),
     Paragraph('<b>Component</b>', table_header_style),
     Paragraph('<b>Description</b>', table_header_style)],
    [Paragraph('1', table_cell_center_style),
     Paragraph('Bybit V5 API', table_cell_style),
     Paragraph('Public endpoints: /v5/market/kline, /v5/market/instruments-info, /v5/market/tickers', table_cell_style)],
    [Paragraph('2', table_cell_center_style),
     Paragraph('/api/bybit/*', table_cell_style),
     Paragraph('Server proxy with in-memory caching (1-5 min TTL). Reduces API calls to Bybit.', table_cell_style)],
    [Paragraph('3', table_cell_center_style),
     Paragraph('/api/cointegration', table_cell_style),
     Paragraph('Fetches klines for N symbols, aligns timestamps, runs Engle-Granger batch scan.', table_cell_style)],
    [Paragraph('4', table_cell_center_style),
     Paragraph('/api/pair-chart', table_cell_style),
     Paragraph('Computes spread, Z-score, Bollinger Bands (20-period, 2 sigma) for a pair.', table_cell_style)],
    [Paragraph('5', table_cell_center_style),
     Paragraph('/api/synthetics', table_cell_style),
     Paragraph('CRUD operations for saved synthetic instruments. Persists to SQLite via Prisma.', table_cell_style)],
    [Paragraph('6', table_cell_center_style),
     Paragraph('React Query + Zustand', table_cell_style),
     Paragraph('Client-side caching and state management. Automatic refetch with staleTime.', table_cell_style)],
    [Paragraph('7', table_cell_center_style),
     Paragraph('UI Components', table_cell_style),
     Paragraph('ScreenerPanel, SyntheticsPanel, ChartPanel render data via lightweight-charts and Recharts.', table_cell_style)],
]

flow_table = Table(flow_data, colWidths=[CONTENT_W * 0.08, CONTENT_W * 0.25, CONTENT_W * 0.67], hAlign='CENTER')
flow_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('BACKGROUND', (0, 1), (-1, 1), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 2), (-1, 2), TABLE_ROW_ODD),
    ('BACKGROUND', (0, 3), (-1, 3), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 4), (-1, 4), TABLE_ROW_ODD),
    ('BACKGROUND', (0, 5), (-1, 5), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 6), (-1, 6), TABLE_ROW_ODD),
    ('BACKGROUND', (0, 7), (-1, 7), TABLE_ROW_EVEN),
]))
story.append(flow_table)

story.append(Spacer(1, 12))

story.append(heading2('5.2 Caching Strategy'))

story.append(body(
    'The application implements a two-layer caching strategy to minimize Bybit API calls and ensure '
    'responsive user experience. The server-side in-memory cache stores raw API responses with configurable '
    'TTL (Time To Live), while the client-side React Query cache prevents redundant network requests within '
    'the stale time window. This combination results in near-instantaneous data loading for repeat visits '
    'while maintaining data freshness appropriate for each data type.'
))

story.append(make_table(
    ['Cache Layer', 'Data Type', 'TTL', 'Storage'],
    [
        ['Server', 'Instruments list', '5 minutes', 'In-memory Map'],
        ['Server', 'Kline data', '1 minute', 'In-memory Map'],
        ['Client', 'All API responses', '1 minute', 'React Query (staleTime)'],
        ['Client', 'Chart data', '1 minute', 'React Query (staleTime)'],
        ['Persistent', 'Saved synthetics', 'None (real-time)', 'SQLite database'],
    ],
    col_widths=[CONTENT_W * 0.18, CONTENT_W * 0.27, CONTENT_W * 0.20, CONTENT_W * 0.35]
))

story.append(Spacer(1, 12))

# ════════════════════════════════════════════
# 6. STATISTICAL ENGINE
# ════════════════════════════════════════════
story.append(heading1('6. Statistical Engine'))

story.append(body(
    'The statistical engine is the core of the application, implementing all quantitative methods from '
    'scratch in TypeScript without external dependencies. It resides in src/lib/cointegration.ts (527 lines) '
    'and is used by both the screener and chart API routes. The engine prioritizes numerical stability '
    'over computational speed, using techniques like Gram-Schmidt orthogonalization and iterative fallback '
    'strategies to handle edge cases in financial time series data.'
))

story.append(heading2('6.1 Components'))

story.append(heading3('6.1.1 OLS Regression'))
story.append(body(
    'Ordinary Least Squares regression computes the linear relationship between two price series. '
    'Given dependent variable Y and independent variable X, it estimates coefficients alpha (intercept) '
    'and beta (slope/hedge ratio) such that Y = alpha + beta * X + epsilon, where epsilon is the residual. '
    'The hedge ratio beta is critical for constructing the spread and determining position sizes in pairs trading.'
))

story.append(heading3('6.1.2 ADF Test (Augmented Dickey-Fuller)'))
story.append(body(
    'The ADF test determines whether a time series is stationary (mean-reverting) or contains a unit root '
    '(random walk). The implementation uses the Frisch-Waugh-Lovell (FWL) theorem for numerical stability, '
    'which avoids direct matrix inversion by sequentially partialing out deterministic terms (constant, trend) '
    'and lagged differences using Gram-Schmidt orthogonalization. P-values are approximated using the '
    'MacKinnon (2010) critical value surface, which maps the test statistic to a significance level based on '
    'sample size. The maximum number of lags is capped at sqrt(n) (maximum 8) with iterative fallback on '
    'convergence failure, trying progressively fewer lags until a valid result is obtained.'
))

story.append(heading3('6.1.3 Engle-Granger Cointegration Test'))
story.append(body(
    'The two-step Engle-Granger procedure tests whether two non-stationary series are cointegrated. '
    'Step 1: Run OLS regression Y = alpha + beta * X + epsilon. Step 2: Run the ADF test on the residuals '
    'epsilon (the spread). If the spread is stationary (ADF rejects the unit root null hypothesis), the series '
    'are cointegrated, meaning a long-run equilibrium relationship exists. The p-value from the ADF test on '
    'residuals uses different critical values than a standard ADF test, which the implementation accounts for.'
))

story.append(heading3('6.1.4 Half-Life of Mean Reversion'))
story.append(body(
    'The half-life measures how quickly the spread reverts to its mean, expressed in number of bars. '
    'It is estimated from the Ornstein-Uhlenbeck process: delta(Spread) = beta * Spread(t-1) + epsilon, '
    'where half-life = -ln(2) / beta. A shorter half-life indicates faster mean reversion, which is '
    'desirable for pairs trading. If beta is non-negative (no mean reversion), the half-life is infinite, '
    'indicating the spread is not mean-reverting and the pair is unsuitable for statistical arbitrage.'
))

story.append(heading3('6.1.5 Z-Score'))
story.append(body(
    'The Z-score normalizes the spread to a standard normal scale: Z = (Spread - Mean) / StdDev. '
    'This allows traders to identify extreme deviations from the mean regardless of the absolute spread '
    'value. Z-scores above +2 or below -2 typically signal trading opportunities (spread is 2+ standard '
    'deviations from its mean), while Z-scores near 0 indicate the spread is at its equilibrium value.'
))

story.append(heading3('6.1.6 Bollinger Bands'))
story.append(body(
    'Bollinger Bands are computed as a 20-period simple moving average (SMA) plus/minus 2 standard '
    'deviations. Applied to the spread series, they provide a rolling measure of expected spread range. '
    'When the spread touches or exceeds the upper/lower band, it suggests the spread has deviated '
    'significantly from its recent average and may be due for a reversal. The first 19 data points return '
    'null values due to insufficient lookback period.'
))

story.append(heading2('6.2 Batch Scan Algorithm'))

story.append(body(
    'The batch scan endpoint accepts a list of N symbols and tests all unique pairs (N*(N-1)/2 combinations) '
    'for cointegration. For each pair, the algorithm: (1) fetches kline data for both symbols, (2) aligns '
    'the series by timestamp, (3) runs the Engle-Granger test, (4) calculates half-life and Pearson '
    'correlation. Results are sorted by p-value ascending and limited to the top 100 pairs. The scan is '
    'computationally intensive for large symbol sets (20 symbols = 190 pairs), so the API has a 60-second '
    'timeout and recommends scanning no more than 15-20 symbols at a time for optimal responsiveness.'
))

# ════════════════════════════════════════════
# 7. API REFERENCE
# ════════════════════════════════════════════
story.append(heading1('7. API Reference'))

story.append(body(
    'All API routes follow Next.js App Router conventions and return JSON responses. GET endpoints accept '
    'query parameters, POST endpoints accept JSON bodies. Error responses include an "error" field with a '
    'descriptive message. All market data endpoints are proxied through the server with caching to reduce '
    'load on the Bybit API and improve response times.'
))

story.append(heading2('7.1 Market Data'))

api_market = [
    ['GET /api/bybit/instruments', 'Fetches all Bybit linear perpetual instruments with ticker data (price, volume, funding rate). Cached for 5 minutes.'],
    ['GET /api/bybit/kline?symbol=X&amp;interval=60&amp;limit=200', 'Fetches OHLCV kline data for a single symbol. Cached for 1 minute.'],
]
for row in api_market:
    story.append(Paragraph(f'<b>{row[0]}</b>', ParagraphStyle(
        'APIEndpoint', fontName='DejaVuSans', fontSize=9, leading=13,
        textColor=ACCENT, spaceBefore=8, spaceAfter=2
    )))
    story.append(body(row[1]))

story.append(heading2('7.2 Cointegration &amp; Charts'))

api_scan = [
    ['POST /api/cointegration', 'Body: { symbols: string[], interval: string, limit: number, significanceLevel: number }. Runs batch scan.'],
    ['GET /api/pair-chart?symbol1=X&amp;symbol2=Y&amp;interval=60&amp;limit=500', 'Returns aligned klines, spread, Z-score, Bollinger Bands, and cointegration stats.'],
]
for row in api_scan:
    story.append(Paragraph(f'<b>{row[0]}</b>', ParagraphStyle(
        'APIEndpoint2', fontName='DejaVuSans', fontSize=9, leading=13,
        textColor=ACCENT, spaceBefore=8, spaceAfter=2
    )))
    story.append(body(row[1]))

story.append(heading2('7.3 Synthetic Instruments'))

api_synth = [
    ['GET /api/synthetics', 'List all saved synthetic instruments.'],
    ['POST /api/synthetics', 'Create a new synthetic. Body: { name, description, type, legs }'],
    ['GET /api/synthetics/[id]', 'Get a single synthetic by ID.'],
    ['PUT /api/synthetics/[id]', 'Update a synthetic.'],
    ['DELETE /api/synthetics/[id]', 'Delete a synthetic.'],
    ['GET /api/synthetics/[id]/chart?interval=60&amp;limit=500', 'Get synthetic OHLCV klines with Z-score and Bollinger stats.'],
]
for row in api_synth:
    story.append(Paragraph(f'<b>{row[0]}</b>', ParagraphStyle(
        'APIEndpoint3', fontName='DejaVuSans', fontSize=9, leading=13,
        textColor=ACCENT, spaceBefore=6, spaceAfter=2
    )))
    story.append(body(row[1]))

story.append(heading2('7.4 Supported Timeframes'))

story.append(body(
    'All chart and kline endpoints support the following interval values, corresponding to the standard '
    'Bybit V5 kline intervals. These intervals cover the full range from tick-level (1 minute) to monthly '
    'analysis, providing flexibility for both short-term scalping and long-term mean-reversion strategies.'
))

story.append(make_table(
    ['Value', 'Interval', 'Value', 'Interval'],
    [
        ['1', '1 minute', '120', '2 hours'],
        ['3', '3 minutes', '240', '4 hours'],
        ['5', '5 minutes', '360', '6 hours'],
        ['15', '15 minutes', '720', '12 hours'],
        ['30', '30 minutes', 'D', '1 day'],
        ['60', '1 hour', 'W', '1 week'],
        ['', '', 'M', '1 month'],
    ],
    col_widths=[CONTENT_W * 0.12, CONTENT_W * 0.38, CONTENT_W * 0.12, CONTENT_W * 0.38]
))

story.append(Spacer(1, 12))

# ════════════════════════════════════════════
# 8. FRONTEND COMPONENTS
# ════════════════════════════════════════════
story.append(heading1('8. Frontend Components'))

story.append(body(
    'The frontend consists of three main panels accessible via a sidebar navigation. Each panel is a '
    'self-contained React component with its own state management via Zustand stores and data fetching '
    'via React Query. The dark-themed trading terminal UI uses a cyan/teal accent color system for a '
    'professional appearance optimized for extended use.'
))

story.append(heading2('8.1 Screener Panel'))

story.append(body(
    'The ScreenerPanel (816 lines) provides the primary workflow for discovering cointegrated pairs. '
    'It consists of three sections: scan parameters at the top, scan results table in the middle, and a '
    'detail panel for the selected pair at the bottom. The instrument selector displays all active Bybit '
    'linear perpetuals sorted by 24h volume, with real-time search filtering. Scan results are presented '
    'in a sortable table showing pair names, p-value (color-coded green for cointegrated, red for not), '
    'ADF statistic, hedge ratio, direction (Long X / Short Y), half-life, correlation, and Z-score. '
    'The detail panel shows inline spread and Z-score charts (Recharts), synthetic formula, and buttons '
    'to create a synthetic or open the pair in the Chart panel.'
))

story.append(heading2('8.2 Synthetics Panel'))

story.append(body(
    'The SyntheticsPanel (413 lines) provides a builder interface for creating synthetic instruments and '
    'a list of saved synthetics. The builder includes fields for name, description, and a dynamic leg list '
    'where each leg has a symbol selector, coefficient input, and long/short toggle. The formula preview '
    'updates in real-time as legs are modified. Saved synthetics are displayed in a list with type badge '
    '(pair/basket), formula display, and buttons to open in the chart or delete. All synthetics persist '
    'in the SQLite database and survive page refreshes and server restarts.'
))

story.append(heading2('8.3 Chart Panel'))

story.append(body(
    'The ChartPanel (1055 lines) provides TradingView-style interactive charts using lightweight-charts v5. '
    'It supports two modes: Pair mode (spread analysis) and Synthetic mode (synthetic instrument price). '
    'Both modes feature multi-pane layouts with the main chart on top and optional Z-Score and Volume panes '
    'below. Charts support pan (mouse drag), zoom (scroll wheel), and crosshair with price/time labels. '
    'The sidebar contains mode toggle, symbol/synthetic selectors, timeframe dropdown, overlay toggles '
    '(Spread, Z-Score, Bollinger Bands), and a statistics panel with key metrics.'
))

story.append(heading3('8.3.1 Chart Features'))
story.append(bullet('Pan: Click and drag to move the chart horizontally and vertically.'))
story.append(bullet('Zoom: Scroll wheel to zoom the time axis; Ctrl+scroll to zoom the price axis.'))
story.append(bullet('Crosshair: Follows cursor, displays price and time labels with cyan accent.'))
story.append(bullet('Bollinger Bands: Upper/lower boundaries as dashed red lines with semi-transparent fill.'))
story.append(bullet('Z-Score: Separate pane below main chart with reference lines at 0, +2, -2.'))
story.append(bullet('Volume: Histogram pane (synthetic mode only) with green/red bars based on candle direction.'))
story.append(bullet('Auto-fit: Chart automatically scales to show all data on initial load.'))

# ════════════════════════════════════════════
# 9. DATABASE SCHEMA
# ════════════════════════════════════════════
story.append(heading1('9. Database Schema'))

story.append(body(
    'The application uses SQLite via Prisma ORM for persistence. The database contains a single table '
    'for storing synthetic instruments. The database file is located at db/custom.db and is referenced '
    'by the DATABASE_URL environment variable. Prisma handles schema migrations and provides type-safe '
    'query building in the API routes. The lightweight SQLite engine is ideal for single-user local '
    'deployment, requiring no separate database server or configuration.'
))

story.append(heading2('9.1 SyntheticInstrument Table'))

story.append(make_table(
    ['Column', 'Type', 'Description'],
    [
        ['id', 'String (CUID)', 'Primary key, auto-generated'],
        ['name', 'String', 'Display name (e.g., "1.0*BTC - 0.85*ETH")'],
        ['description', 'String (optional)', 'User-provided description'],
        ['type', 'String', '"pair" (2 legs) or "basket" (3+ legs)'],
        ['legs', 'String (JSON)', 'Serialized leg array: [{symbol, coefficient, side}]'],
        ['createdAt', 'DateTime', 'Auto-set on creation'],
        ['updatedAt', 'DateTime', 'Auto-updated on modification'],
    ],
    col_widths=[CONTENT_W * 0.18, CONTENT_W * 0.22, CONTENT_W * 0.60]
))

story.append(Spacer(1, 8))

story.append(heading2('9.2 Legs JSON Structure'))

story.append(body(
    'The legs field stores a JSON-serialized array of leg objects. Each leg represents one component '
    'of the synthetic instrument with its trading direction and weight. The coefficient is always positive; '
    'the direction is determined by the side field. The synthetic price is computed as the weighted sum '
    'of leg prices, where long legs contribute positively and short legs contribute negatively.'
))

story.append(code(
    '[\n'
    '  { "symbol": "BTCUSDT", "coefficient": 1.0, "side": "long" },\n'
    '  { "symbol": "ETHUSDT", "coefficient": 0.85, "side": "short" }\n'
    ']'
))

story.append(Spacer(1, 8))

story.append(body(
    '<b>Synthetic price formula:</b> Price = 1.0 * BTC - 0.85 * ETH. When creating a synthetic from '
    'the screener, the long/short sides are automatically determined by the cointegration relationship: '
    'symbol1 is long (coefficient 1.0), symbol2 is short (coefficient = hedge ratio). If the hedge ratio '
    'is negative, both legs are set to long with the absolute value of the hedge ratio as the second coefficient.'
))

# ════════════════════════════════════════════
# 10. CONFIGURATION
# ════════════════════════════════════════════
story.append(heading1('10. Configuration'))

story.append(heading2('10.1 Environment Variables'))

story.append(body(
    'The application requires only one environment variable, which is set by default. No API keys are '
    'needed because all Bybit endpoints used are public market data endpoints that do not require authentication. '
    'This makes deployment straightforward and eliminates the security concern of storing exchange API credentials.'
))

story.append(make_table(
    ['Variable', 'Required', 'Default', 'Description'],
    [
        ['DATABASE_URL', 'Yes', 'file:./db/custom.db', 'SQLite connection string (Prisma format)'],
    ],
    col_widths=[CONTENT_W * 0.20, CONTENT_W * 0.12, CONTENT_W * 0.28, CONTENT_W * 0.40]
))

story.append(Spacer(1, 8))

story.append(heading2('10.2 NPM Scripts'))

story.append(make_table(
    ['Script', 'Command', 'Description'],
    [
        ['dev', 'next dev -p 3000', 'Start development server with hot reload'],
        ['build', 'next build', 'Create production build (standalone output)'],
        ['start', 'bun .next/standalone/server.js', 'Run production server'],
        ['lint', 'eslint .', 'Run ESLint code quality checks'],
        ['db:generate', 'prisma generate', 'Generate Prisma client from schema'],
        ['db:push', 'prisma db push', 'Push schema changes to database'],
        ['db:migrate', 'prisma migrate dev', 'Create and apply schema migration'],
        ['db:reset', 'prisma migrate reset', 'Reset database (destructive!)'],
    ],
    col_widths=[CONTENT_W * 0.15, CONTENT_W * 0.35, CONTENT_W * 0.50]
))

story.append(Spacer(1, 8))

story.append(heading2('10.3 Next.js Configuration'))

story.append(body(
    'The next.config.ts file configures the application with standalone output mode for minimal deployment '
    'size, disables TypeScript build errors (since lint handles type checking separately), and turns off '
    'React strict mode to prevent double-rendering effects in development. These settings are optimized '
    'for the production deployment scenario described in Section 3.'
))

story.append(make_table(
    ['Option', 'Value', 'Rationale'],
    [
        ['output', '"standalone"', 'Minimal production bundle without full node_modules'],
        ['typescript.ignoreBuildErrors', 'true', 'TypeScript checked via ESLint instead'],
        ['reactStrictMode', 'false', 'Prevents double-render side effects with Zustand'],
    ],
    col_widths=[CONTENT_W * 0.30, CONTENT_W * 0.20, CONTENT_W * 0.50]
))

story.append(Spacer(1, 12))

# ════════════════════════════════════════════
# 11. TROUBLESHOOTING
# ════════════════════════════════════════════
story.append(heading1('11. Troubleshooting'))

story.append(heading2('11.1 Common Issues'))

story.append(heading3('Issue: "Bybit Disconnected" badge'))
story.append(body(
    'This indicates the server cannot reach the Bybit API. Check your internet connection and verify '
    'that api.bybit.com is accessible from your network. If you are behind a corporate firewall or proxy, '
    'you may need to configure HTTP_PROXY and HTTPS_PROXY environment variables. The application checks '
    'connectivity every 60 seconds by fetching the instruments list, so the badge should update automatically '
    'once connectivity is restored.'
))

story.append(heading3('Issue: P-Value is always 1.000'))
story.append(body(
    'This was a known bug in early versions caused by incorrect lag indexing in the ADF test. The current '
    'version uses the Frisch-Waugh-Lovell theorem with Gram-Schmidt orthogonalization, which is numerically '
    'stable and produces correct p-values. If you still observe this issue, ensure you are using the latest '
    'version of src/lib/cointegration.ts. The ADF test now caps maximum lags at sqrt(n) with iterative '
    'fallback, which resolves the convergence failures that previously led to degenerate test statistics.'
))

story.append(heading3('Issue: Scan takes too long'))
story.append(body(
    'Batch cointegration scan complexity is O(N^2) where N is the number of selected symbols. For 20 symbols, '
    'this means 190 pairs, each requiring kline fetching, alignment, and statistical testing. To improve '
    'performance: (1) reduce the number of selected symbols to 10-15, (2) use a longer interval (e.g., 1H '
    'instead of 1m) to reduce data points, (3) reduce the data point limit. The server-side kline cache '
    '(1-minute TTL) helps significantly when scanning the same symbols across multiple pairs.'
))

story.append(heading3('Issue: Chart does not render'))
story.append(body(
    'The chart uses lightweight-charts v5, which requires a valid DOM container with non-zero dimensions. '
    'If the chart area appears blank, check that the container has explicit height set (min-height: 400px). '
    'Also verify that the API returns valid data by checking the browser console for errors. Common causes '
    'include: insufficient data points (need at least 30 aligned points), invalid symbol names, or Bybit API '
    'rate limiting (429 status). The chart will display a loading indicator while data is being fetched.'
))

story.append(heading3('Issue: Database errors'))
story.append(body(
    'If you encounter Prisma database errors, ensure the DATABASE_URL points to a valid file path with write '
    'permissions. Run "bun run db:push" to recreate the schema. If the database file is corrupted, delete '
    'db/custom.db and run "bun run db:push" again. Note that this will delete all saved synthetic instruments. '
    'For migration-related issues, run "bun run db:reset" (also destructive) to start with a fresh database.'
))

story.append(heading2('11.2 Performance Tips'))

story.append(bullet('Use 1H or 4H intervals for scanning instead of 1m — fewer data points, faster computation.'))
story.append(bullet('Limit scan to 10-15 symbols at a time to avoid API rate limits and timeout issues.'))
story.append(bullet('The server caches kline data for 1 minute — running scans in quick succession benefits from cache hits.'))
story.append(bullet('For production deployment, consider increasing the limit parameter from 500 to 1000 for more chart history.'))
story.append(bullet('SQLite performance degrades with very large datasets. If you save hundreds of synthetics, consider migrating to PostgreSQL by changing the DATABASE_URL and Prisma provider.'))

# ════════════════════════════════════════════
# BUILD PDF
# ════════════════════════════════════════════
doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(f"PDF generated: {output_path}")
print(f"File size: {os.path.getsize(output_path)} bytes")
