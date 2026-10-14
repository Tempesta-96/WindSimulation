# Wind Studio

Local home airflow planner with a floor-plan editor, image wall detection, and ceiling/standing fan recommendations. At least one ceiling fan is required. No dependency installation needed.

## Run

```powershell
python server.py
```

Open http://localhost:8000. Choose another port with `python server.py --port 8080`.

## GitHub Pages

The app runs entirely in the browser and can be hosted as a static GitHub Pages site; the Python server is only needed for local development.

1. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `main` or manually run **Deploy Wind Studio to GitHub Pages** from **Actions**.
3. The workflow runs the regression tests, uploads only `web/`, and publishes it at https://tempesta-96.github.io/WindSimulation/.

Asset and worker paths are relative, so the app supports the repository subpath. Plans remain in browser local storage, separately from plans saved on localhost; use Save plan / Import floor plan to transfer them. Local image backdrops must be imported again. Public hosting publishes the app files; imported plans are processed in the visitor's browser.

## Use

1. Load the example, create a blank plan, or import PNG/JPG/WebP or saved JSON.
2. Set real width/depth in meters. Crop images to the floor boundary before import; images fill the dimensions provided.
3. Draw walls and rectangular furniture by dragging; click to mark occupied areas. Place doors/windows in gaps in walls. Erase and Undo correct errors.
4. Image wall detection extracts dark horizontal/vertical segments. Review text, artifacts, and thick strokes; add openings manually. Detection replaces existing walls; Undo restores them. PDF/CAD import is not supported.
5. Choose fan counts, assumed reach, and priorities. Analyze to see positions, directions, and estimated coverage. Save your plan or export a JSON report.

Plans autosave in browser local storage. Image backdrops do not persist. Files are processed locally. Optional Google Fonts loads typography; fallback fonts work offline.

## Model

The model samples usable floor space and scores candidates on a coarse grid. Ceiling fans have radial influence; standing fans have directional influence with twelve candidate directions. Walls and furniture block line of sight. Fan candidates are seeded in two insertion orders and refined with up to three coordinate-ascent passes that reconsider every fan position and direction. Influence vectors are cached. Optimization runs in a Web Worker so the editor stays responsive; editing cancels stale optimization. Coverage counts floor samples with combined influence at least 0.20. Cooling and ventilation indices are normalized heuristic scores, not physical efficiency percentages.

Ventilation targets follow clear straight paths between openings assumed open. Pressure, outside wind, air changes, and airflow around corners are not calculated. Use Draw outline to click outer corners in order and Finish outline for irregular footprints, including L-shapes and angled edges. Outside areas are excluded from sampling and fan placement, and airflow cannot pass across exterior cutouts. Width/depth define the drawing bounds and may differ. Reset rectangle restores the default perimeter. Outlines persist in saved plans and scale with dimensions. Boundaries must not cross themselves. Existing elements are retained; review elements outside the new outline. Ceiling height, blade diameter, speed, temperature, and 3D flow are not modeled. This compares layouts; it is not CFD or a guarantee of the globally best placement. Confirm installation suitability separately.

## Test

```powershell
node --test tests/*.test.js
```

## Walls and rooms

Orthogonal walls is enabled by default for walls, openings, and new outline edges. Disable it to draw angled walls. Snap to nearby walls aligns points within 0.3 m with existing walls or the exterior. Rectangle room edges snap to nearby horizontal/vertical walls.

Choose Room / resize and drag to create a rectangle. Click a room to select it, then drag any corner handle while its opposite corner stays fixed. Enable Square rooms to keep both sides equal while creating/resizing. Rooms can share or overlap existing wall lines and are constrained to the house, including concave outlines. Rooms have wall perimeters, not solid furniture interiors; draw doors/windows on their edges to provide airflow openings. Existing independent walls are retained when a room is resized or deleted. Undo restores the previous shape. Rooms persist in JSON plans.

## Optimizing fan quantity

Automatic count mode treats ceiling and standing counts as maximum limits, tests total counts in ascending order, with at least one ceiling fan, and jointly optimizes positions/directions for each mix. It tests every mix at the first feasible total, then stops. The default strategy chooses the fewest tested fans meeting every target. Defaults: 100% sampled floor coverage at influence >= 0.20, even-airflow index 70, occupied cooling index 70, and ventilation-path index 60. These adjustable thresholds are planning assumptions, not engineering comfort standards. Missing occupied areas or valid opening paths prevent a claim of sufficiency. If no tested mix satisfies all targets, the app displays the closest constraint-search layout only as a diagnostic and lists shortfalls. Alternatives appear in a comparison table. Other strategies select the maximum weighted score or fewest fans within 3 points of the best. Disable automatic counts for exact quantities.

The even-airflow objective averages sqrt(min(1, total influence)), rewarding improvements in weak areas. Cooling and ventilation average min(1, total influence) over their respective targets. The weighted objective normalizes slider weights over available goals. In minimum-count mode, location search instead prioritizes feasibility: normalized squared deficits across all four targets, with a continuous low-flow penalty to guide coverage improvements. Feasible layouts always outrank infeasible ones; weights break ties among feasible layouts. Fixed-grid local search cannot guarantee a global optimum; minimum fan count means minimum among layouts found by this search. All scores depend on the simplified airflow proxy, and 100% coverage refers to sampled points rather than every continuous point in the house. Real ventilation needs pressure/wind and flow-rate modeling.

## Natural wind

Enable Include natural wind, choose where wind blows toward (clockwise from right/east), set a relative strength index and an assumed indoor reach. Exterior windows/doors are assumed open. Only upwind openings that admit wind into the polygon create sources; internal doors do not. Influence decays along the wind direction, spreads laterally based on opening width, and is blocked by walls, room edges, furniture, and exterior cutouts. This baseline is included in every layout before optimizing fans; the heatmap and scores combine both contributions. Blue inlet arrows show incoming wind. At least one ceiling fan remains required even if natural wind is sufficient.

This is a manually configured scenario, not a live weather feed, pressure model, or physical wind-speed prediction. Natural wind may change over time; compare with wind disabled to plan for calm conditions. Natural-wind settings appear in exported analysis reports.

## Occupied-area priority

Occupied cooling has a default slider value of 100 and a 2x effective weight. Every valid occupied marker must individually meet the cooling target; the reported cooling metric is the weakest marker, not their average. Constraint search gives cooling deficits fourfold emphasis and penalizes per-marker shortfalls. Standing-fan candidates include directions aimed exactly at occupied markers, in addition to twelve base directions. Results report each marker's index and whether it meets the target. Averages used by the weighted objective cannot override the per-marker feasibility requirement. Markers represent individual locations, not continuous occupancy polygons.

## Manual fan evaluation

Enable Place fans manually. Select Add ceiling fan or Add standing fan and click inside the house. Move / select fan lets you select and drag a fan; selecting a standing fan lets you adjust its direction slider, clockwise from right. Remove fan deletes the clicked fan. Undo restores edits. Fan positions persist in saved JSON and browser autosave and scale with plan dimensions. Manual mode supports up to 30 fans, including zero fans for evaluating natural wind alone; the required ceiling fan applies to automatic recommendations only.

Calculate placed-fan airflow evaluates these exact positions/directions with the same wall-aware influence model and optional natural wind. It does not optimize or relocate fans. The heatmap, per-occupied-location values, coverage and goal indices report the manual arrangement, with unmet constraints shown explicitly. Manual fans need 0.15 m clearance from walls/furniture; invalid placements caused by later structural edits are rejected at calculation time. This remains a planning estimate rather than CFD or a physical circulation simulation.
