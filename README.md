# ForenText v2.0 – Integrated Messaging Forensics Analysis & Reporting Platform

**Academic Final-Year Engineering Project in Digital Forensics & Cyber Security**

ForenText v2.0 is an integrated, privacy-preserving digital messaging forensics platform that parses exported text-based conversations (e.g. WhatsApp exports), performs contextual NLP entity extraction, conducts cross-participant message correlation, synthesizes chronological event clusters, renders interactive network graphs, provides centralized search and filtering, and generates official forensic PDF reports with SHA-256 evidence integrity.

---

## 🛡️ Key Forensic Modules (Version 2.0)

1. **Evidence Integrity & Chain of Custody (SHA-256)**:
   - Computes cryptographic SHA-256 digests in-browser using the W3C Web Cryptography API.
   - Preserves source file line indices and byte positions for 100% evidence traceability.

2. **Contextual NLP & Advanced Intent Analysis**:
   - Identifies potentially relevant messages even without predefined keywords (e.g., arrivals, vehicle spotters, unattended objects, document handovers).
   - Differentiates detected information, potentially relevant information, and items requiring manual verification.
   - Provides clear rationale, extraction method, and false-positive disambiguation for every finding.

3. **Expanded Entity Extraction & Normalisation**:
   - People: Personal names, formal titles, digital handles (e.g. `@shadow_ops24`).
   - Geographical Entities: Cities, transit hubs, railway stations (`Powerpet railway station`), landmarks (`old building`, `warehouse`).
   - Vehicles: Plates (`DL 03 CC 4921`, `MH 12 DE 1432`), models (`Swift`, `Scorpio`, `Fortuner`), and color combinations (`white Swift`, `black SUV`).
   - Objects: Bags (`black backpack`), containers, electronics (`hard drive`, `pendrive`), and weapons.
   - Documents & Identifiers: `property papers`, `blue file`, `deed`, `Aadhaar`, `PAN card`, phones, emails, and UPI handles.
   - Normalisation: Groups alternative descriptions without destructive merging for investigator review.

4. **Cross-Participant Message Correlation**:
   - Connects messages across participants based on shared entities, semantic similarity, and temporal proximity.
   - Allows investigators to confirm or reject suggested relationships.

5. **Event Clustering & Multi-Stage Sequences**:
   - Synthesizes chronological multi-stage event clusters (planning, transit, spotting, handover) linking participants, locations, vehicles, and objects.

6. **Interactive Relationship Graphs**:
   - Participant Communication Network.
   - Entity Mentions Graph (color-coded nodes for participants, locations, vehicles, objects, documents).
   - Event Relationship Graph.
   - 24-Hour Diurnal Communication Rhythm.
   - Node selection with evidence drawer and direct links to source messages.

7. **Central Forensic Search & Filter Hub**:
   - Free text queries, participant filters, entity category selectors, review status, and semantic intent concepts.

8. **Configurable Forensic PDF Report**:
   - Multi-page publication-grade PDF report with selectable sections, custody hash, entity catalogs, correlations, event clusters, wrapped disclaimer box, and examiner seal lines.

9. **100% Offline & Windows Compatible**:
   - Runs locally without external databases, cloud backends, or paid AI APIs.

---

## 💻 System Requirements

- **Operating System**: Windows 10/11, macOS, or Linux.
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/)).
- **Package Manager**: npm (bundled with Node.js).
- **Web Browser**: Google Chrome, Microsoft Edge, Mozilla Firefox, or Brave.

---

## 🚀 Step-by-Step Installation & Execution on Windows

### Step 1: Extract the ZIP Archive
1. Right-click the downloaded `ForenText-v2.0-Complete-Source.zip` file.
2. Select **"Extract All..."** and choose a destination folder (e.g., `C:\Projects\ForenText`).
3. Open the extracted folder.

### Step 2: Open Command Prompt or PowerShell
1. In the extracted folder, hold `Shift` and right-click on an empty space, then select **"Open PowerShell window here"** (or open Command Prompt and `cd` to the directory).

### Step 3: Install Dependencies
Run the following command to download and install all required local packages:
```bash
npm install
```

### Step 4: Launch the Local Development Server
Once dependencies are installed, start the local server:
```bash
npm run dev
```

### Step 5: Open in Web Browser
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🧪 Testing with Sample Evidence

A sample fictional WhatsApp export is included in the project:
`sample_whatsapp_chat.txt`

1. In the ForenText interface, click on the **"Upload Evidence"** tab in the sidebar.
2. Either click **"Load Fictional Demo Case"** to immediately load the sample, or click **"Select File"** and choose `sample_whatsapp_chat.txt`.
3. Explore Message Analysis, Entity Extraction, Message Correlation, Event Clustering, Relationship Graphs, Advanced Search, and generate your Forensic PDF report.

---

## 📁 Project Architecture

- `src/types/forensics.ts`: Core TypeScript interfaces for evidence records, entities, correlations, and event clusters.
- `src/utils/whatsappParser.ts`: High-resiliency parser handling multiple timestamp formats, line numbers, and media tags.
- `src/utils/nlpExtractor.ts`: Rule-based entity extraction and normalisation linker.
- `src/utils/relevanceClassifier.ts`: Contextual heuristics, intent detection, and false-positive disambiguation.
- `src/utils/correlationEngine.ts`: Message correlation and multi-stage event clustering.
- `src/utils/graphDataBuilder.ts`: Deterministic network graph models and 2D layout engine.
- `src/utils/hashHelper.ts`: W3C Web Cryptography SHA-256 hashing.
- `src/utils/pdfGenerator.ts`: Multi-page jsPDF forensic evidence reporting engine.
- `src/components/`: Modular React components for Overview, Ingestion, Message Analysis, Entities, Findings, Correlations, Events, Timeline, Graphs, Search, and PDF Preview.

---

## ⚖️ Academic & Forensic Disclaimer

Automated findings generated by ForenText v2.0 are preliminary investigative indicators intended to assist human examiners during triage. Pattern matches must be corroborated against authoritative records (RTO/DMV databases, legal documents). No criminal culpability is inferred or established by automated algorithms.
