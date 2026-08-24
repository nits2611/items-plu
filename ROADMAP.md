# My Produce Assistant Roadmap

## Current Sprint

- [x] Order History tabs/search/pagination — Barcode UX Pack

- [x] Barcode Renderer v2 — shared, consistent scanner-safe presentation
- [x] Large Barcode Viewer — tap barcode to open focus mode
- [ ] Long-Press Barcode Menu — large barcode / copy code / product details placeholder
- [ ] Verify shared barcode component across all relevant screens

## Next Sprint — Lookup Redesign

- Product card hierarchy
- Search/filter presentation
- Back Stock quantity interaction
- Empty/no-result states
- Responsive mobile and desktop refinement

## Parking Lot

- Previous / Next in barcode viewer
- Swipe between barcode results
- Auto-close after external scan
- Landscape barcode mode
- QR code support
- Voice search
- Multi-store expansion
- Supplier module

## Development Rule

Discuss → freeze scope → implement → local test → live smoke test → mark stable → next task.

- [x] v52.2 Lookup redesign

## Completed — Product image library
- [x] Canonical product `images[]` model
- [x] Full-screen product image gallery
- [x] Missing Item multi-image editor
- [x] Primary thumbnail selection
- [x] Preserve image arrays through Missing Item → Catalog

- [x] Unified Today's Order workflow

- [x] Order architecture cleanup (Controller → Service → Repository → Provider)


## Current: Basic Shrink Count
- [x] Step 1: dedicated route, navigation, and empty workspace
- [ ] Step 2: product search by name / PLU
- [ ] Step 3: today's shrink quantity save/edit/remove
- [ ] Step 4: simple dated history
- [ ] Step 5: contextual scanner integration

Note: build each step from the stable baseline and verify Lookup/product loading before continuing.

- [x] Shrink scanner uses existing contextual barcode scanner.

- [x] Basic Shrink Count: quantity + measurement + today list + history
