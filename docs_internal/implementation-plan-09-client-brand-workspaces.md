# Implementation Plan: Client and Brand Voiceover Workspaces

## Related Enhancement

Client/Brand Voiceover Workspaces.

## Current Foundations

- Custom presets can represent reusable voice personas.
- Tags and colors help organize presets.
- History search and export exist.
- Future project, dictionary, style, and export profile systems will provide most of the needed primitives.

## Target Outcome

Short-form commercial and client work can be organized by client or brand. Each workspace can store preferred voices, pronunciation rules, style presets, render defaults, naming rules, and reusable script variants.

## Phase 1: Client Data Model

Add migrations:

- `clients`
  - `id`
  - `name`
  - `description`
  - `brand_notes`
  - `default_provider`
  - `default_model`
  - `default_voice_name`
  - `default_preset_id`
  - `default_style_id`
  - `default_export_profile_id`
  - `metadata_json`
  - timestamps

- `client_assets`
  - `id`
  - `client_id`
  - `asset_type` (`preset`, `style`, `dictionary`, `project`, `export_profile`)
  - `asset_id`
  - `label`
  - timestamps

Add nullable `client_id` to projects and dictionaries.

## Phase 2: APIs

Routes:

- `GET /api/clients`
- `POST /api/clients`
- `GET /api/clients/{id}`
- `PUT /api/clients/{id}`
- `DELETE /api/clients/{id}`
- `GET /api/clients/{id}/assets`
- `POST /api/clients/{id}/assets`
- `DELETE /api/clients/{id}/assets/{assetId}`

Project creation:

- `client_id` may be provided.
- Defaults are inherited from client settings.

## Phase 3: Campaign and Variant Structure

Represent a campaign as a project with kind `voiceover`.

Add segment templates:

- 15 second spot
- 30 second spot
- 60 second spot
- social cutdown
- radio read
- explainer VO

Add variant metadata:

- `variant_name`
- `target_duration_seconds`
- `channel`
- `approval_status`

This can live in `script_segments.metadata_json` at first, then graduate to a `script_variants` table if the workflow proves complex.

## Phase 4: UI

Add components:

- `ClientWorkspaceList.tsx`
- `ClientProfileEditor.tsx`
- `ClientAssetPanel.tsx`
- `CampaignVariantGrid.tsx`

Navigation:

- Keep client workspaces under Projects initially.
- Add a client filter in project list.
- Later add a dedicated Clients nav item if usage justifies it.

## Phase 5: Batch Variant Rendering

Use the batch render system to render all variants in a campaign.

Export:

- approved variants only
- all candidate takes
- client naming template
- notes CSV

## Technical Risks

- Clients, projects, presets, and styles can create too many organizational layers. Start with simple client records and inherited defaults.
- Campaign variants should not require a separate complex table in v1.
- Avoid making this feature mandatory for users doing one-off scripts.

## Testing Plan

Backend:

- Client CRUD tests.
- Inheritance tests for project defaults.
- Asset linking tests.

Frontend:

- Project creation from client workspace.
- Variant grid manual flow with Playwright once projects exist.

## Exit Criteria

- A creator can create a client, attach preferred voices/styles/dictionaries, create a campaign project, render variants, and export them with client-specific naming.

