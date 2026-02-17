# NeuroFlow Lab

NeuroFlow Lab is an open-source EEG research tool for modern neuroscience workflows. It empowers researchers, clinicians, and students to upload, clean, and visualize EEG data with scientifically validated filter presets and context-driven recommendations.

---

## Goal

To make EEG research accessible, reproducible, and scientifically rigorous by providing an intuitive, context-aware platform for EEG data analysis.

## Objectives

- Bridge the gap between neuroscience research and practical data analysis.
- Enable users to apply best-practice EEG filters with context-driven presets.
- Reduce errors and confusion in EEG preprocessing by providing clear guidance and recommendations.
- Support open science and collaboration by making EEG workflows transparent and easy to share.
- Help both beginners and experts work with EEG data confidently and efficiently.

## Unique Selling Points (USP)

- **Context-Driven Filter Presets**: Automatically recommends best-practice filter values based on use case, age group, and device type.
- **Interactive Visualization**: Compare raw and cleaned EEG data, view metadata, and download results.
- **Info/Help Section**: Built-in scientific guidance for filter selection and preprocessing.
- **Modern UI**: Responsive, accessible, and visually appealing interface using Tailwind CSS.
- **Open Source**: Transparent, extensible, and community-driven.

## Use Cases

- Academic EEG research
- Clinical EEG preprocessing
- Neurofeedback and BCI workflows
- Sleep and cognitive task-based EEG studies
- Teaching and student projects

## How to Use

1. **Upload EEG File**: Drag & drop or browse to select your EEG file (.edf, .csv, .mat).
2. **Set Context**: Choose use case, age group, and device type for recommended filter presets.
3. **Adjust Filters**: Override presets if needed for custom analysis.
4. **Visualize Data**: Compare raw and cleaned EEG, view metadata.
5. **Download Results**: Export as JSON or CSV.

## Features

- EEG File Upload (.edf, .csv, .mat)
- Context Panel (use case, age group, device type)
- Filter Controls (bandpass, notch, lowpass, highpass)
- Info/Help Section (scientific guidance)
- Download Cleaned/Raw EEG Data
- Responsive UI (Tailwind CSS)

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm, yarn, or pnpm

### Installation

Clone the repository and install dependencies:

```bash
git clone <your-repo-url>
cd neuroflow-lab/nextjs-app
npm install
```

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Backend Setup

The EEG cleaning and parsing backend is a FastAPI app located in `../backend`. Start it separately:

```bash
cd ../backend
uvicorn main:app --reload
```

### File Structure

- `src/app/page.tsx`: Main UI (upload, context panel, filter controls, visualization)
- `src/app/docs/page.tsx`: Documentation page
- `src/app/about/page.tsx`: About page (project goals, rationale)
- `backend/main.py`: FastAPI backend for EEG parsing and cleaning
- `datasets/`: Example EEG files

## Filter Recommendations

| Filter Type   | Default Value | Valid Range | Rationale |
|-------------- |-------------- |------------ |-----------|
| High-pass     | 0.5 Hz        | 0.1–1 Hz    | Removes slow baseline drift, preserves delta (<4 Hz) |
| Low-pass      | 45 Hz         | 30–70 Hz    | Removes high-frequency noise, keeps delta–beta bands |
| Band-pass     | 1–45 Hz       | 1–50 Hz     | Standard EEG frequency range |
| Notch         | 50 Hz         | 50/60 Hz    | Removes line power noise (region-specific) |

## Scientific Rationale

- **Context presets** are based on published EEG best practices and lab standards.
- **Filter values** are auto-filled for common use cases but can be overridden for advanced analysis.
- **Info/Help section** provides guidance and references for preprocessing choices.

## Contributing

Feedback and contributions are welcome! Please open issues or pull requests for bug fixes, features, or scientific improvements.

## License

MIT License

## Acknowledgements

- Built with [Next.js](https://nextjs.org) and [Tailwind CSS](https://tailwindcss.com)
- Backend powered by [FastAPI](https://fastapi.tiangolo.com)
- Inspired by open science and EEG research communities
