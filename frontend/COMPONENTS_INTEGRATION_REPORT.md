# Shadcn & TypeScript Component Integration Report

This report outlines the integration details for the 3D stacked **DisplayCards** component into the QuantML Platform.

---

## 1. Project Configuration Status

The project now fully supports:
- **Tailwind CSS**: Initialized and linked with `@tailwind` directives in `src/index.css`.
- **shadcn project structure**: Configured via `components.json` mapping.
- **TypeScript**: Installed package dependencies and generated `tsconfig.json`.

### Verification commands executed:
```bash
# 1. Installed Tailwind & Radix dependencies
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p

# 2. Created shadcn configuration (components.json)
# 3. Installed react & compiler types
npm install -D typescript @types/react @types/react-dom
npx tsc --init

# 4. Verified production compiling successfully
npm run build
```

---

## 2. Directory Structure & Path Decisions

* **Components Root**: `src/components/ui/`
* **Styles Root**: `src/index.css`

### Why `/components/ui/` is Critical:
1. **Separation of Concerns**: Differentiates atomic, reusable base blocks (primitives like `button`, `input`, `card`) from page-level layouts or domain-specific modules.
2. **Shadcn Registry Standard**: The shadcn CLI compiles and installs UI primitives directly to `/components/ui/` by default. Keeping this path ensures CLI command outputs (`npx shadcn add`) merge cleanly without broken import paths.
3. **Refactoring Portability**: Having utility-styled base components collected in a single directory allows them to be shared across multi-page templates easily.

---

## 3. Integration & Implementation Analysis

### Questions & Answers:

#### Q1: What data/props will be passed to this component?
* An array of card items (`cards`). Each card contains:
  * `icon` (ReactNode): e.g., `<Sparkles className="size-4" />`.
  * `title` (string): Title text (e.g. "Opening Range Breakout").
  * `description` (string): Subtitle summary.
  * `date` (string): Status tags (e.g. "Intraday (1m-5m)").
  * `className` (string): Custom Tailwind transition, transforms, and grid layouts.

#### Q2: Are there any specific state management requirements?
* No external global state is needed. The component relies on CSS pseudo-classes (`hover:`, `before:`) and browser transition durations to handle 3D hover actions and skews.

#### Q3: Are there any required assets (images, icons, etc.)?
* Icons are rendered using `lucide-react` (e.g., `Sparkles`, `TrendingUp`, `Zap`, `BarChart`).
* No heavy image files are required.

#### Q4: What is the expected responsive behavior?
* On mobile screens, stacked cards skew down dynamically. The container is centered using CSS Grid with auto placement.

#### Q5: What is the best place to use this component in the app?
* Used on the **Homepage** (`Home.jsx`) directly below the hero banner to present the **Algorithmic Intraday Strategies** in a modern, interactive way.

---

## 4. Installed Source Code

### DisplayCards (`src/components/ui/display-cards.tsx`)
* Contains the skewed, 3D stacked layout that shifts cards on mouse-over.

### Demo (`src/components/ui/demo.tsx`)
* Contains the demo configurations showcasing standard use cases.
