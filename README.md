# Slot Scene — Pixi.js + TypeScript

A small 5×3 slot prototype. Pixi.js renders the symbols, while the control panel uses standard DOM elements.

## Run

```bash
npm i
npm run dev
```

To verify the production build:

```bash
npm run build
```

## Architecture and data flow

- `src/domain/SlotModel.ts` — a pure domain model. It stores balance, bet, and win; deducts the bet at spin start and credits the result. It knows nothing about Pixi, UI, or timers.
- `src/viewmodel/SlotViewModel.ts` — the single reactive state contract. UI sends intents to it (`spin`, `stop`, `auto`), while the scene uses it to update phases and domain data. Subscriptions receive one `SlotState` object.
- `src/core/BaseViewModel.ts` — a shared abstract base class for reactive ViewModels. It provides subscriptions, and `SlotViewModel` extends it.
- `src/ui/SlotUI.ts` — renders `SlotState` and calls public ViewModel methods only. It has no reference to the scene.
- `src/scene/SlotScene.ts` — the Pixi board and a small state machine with `idle → spinning → win → returning → idle` states. It listens for ViewModel intents, requests a mock result, renders the animation, and reports phase changes back to the ViewModel.
- `src/core/BaseScene.ts` — a shared abstract Pixi scene class that creates the `Application` and mounts the canvas. `SlotScene` extends it and creates its own display tree.
- `src/services/SpinMock.ts` — a local result mock. It can be replaced with an API client without changing the UI or domain model.

The only data path is **UI → ViewModel → Scene → ViewModel → UI/Scene**. There are no direct UI ↔ Scene calls.
