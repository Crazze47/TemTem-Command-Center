# Temtem Command Center

A lightweight, local web application designed to track progression, breeding lines, logistics, and hunting stats in Temtem. Built purely with responsive HTML5, CSS3, and JavaScript, it organizes repetitive daily routines and complex breeding projects into a clean, interactive dashboard.

## 🚀 Features

* **FreeTem Hunting Tracker:** Track multi-species catch-and-release sessions. Includes a built-in live session clock, snapshot comparison tools for individual capture spans, percentage calculators, and average encounter duration metrics.
* **Breeding Lab:** A modular workspace to organize breeding stock, plan lineage combinations, check valid egg-move inheritance lists, and track target single-value (SV) configurations.
* **Master TemDeck:** A comprehensive, searchable database index covering native elemental types, family lineage systems, and valid egg-move pools.
* **Logistics & Checklist Dashboards:** Dedicated task sections classifying cyclical activities like Daily Postal Service deliveries, weekly faction checklists, and macro long-term gameplay milestones.

## 📂 Project Structure

```text
├── temtem_tracker.html    # Core dashboard interface layout and UI routing
├── tem_database.js        # Relational static data dictionary for species details and movepools
├── style.css              # Custom unified dark-mode presentation styles
├── icons/                 # UI asset library mapping elemental types and luma markers
└── Breedingchanges*.html  # Legacy iterative prototyping and architectural design baselines
```

## 🛠️ Tech Stack
Markup: HTML5 semantic layout architecture

Styling: CSS3 custom properties (variables) featuring a unified cyber-red dark aesthetic, grid layouts, and absolute-scrolling tables

Logic Engine: Vanilla JavaScript handling dynamic table querying, modular layout filters, and state calculations

## ⚡ Quick Start
Because this application relies entirely on client-side compilation, you do not need to configure complex database servers or local runtime environments:

Clone or download this repository onto your local workspace.

Navigate into the folder directory.

Open temtem_tracker.html directly in any standard, modern web browser.