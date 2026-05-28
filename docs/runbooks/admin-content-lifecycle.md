# Admin Content Lifecycle Runbook

## Lifecycle States
- `draft`: created but not visible in catalogs.
- `review`: waiting for admin review.
- `published`: visible in public catalogs when metadata visibility is also visible.
- `unpublished`: hidden from public catalogs, recoverable.
- `archived`: retained for history, hidden from public catalogs, recoverable.
- `deleted`: soft-deleted, hidden from public catalogs, restorable by admin.

## Emergency Takedown
1. Open `/admin/content-management`.
2. Select the affected item in Admin Resource Queue.
3. Use `Unpublish`, `Archive`, or `Delete` depending on severity.
4. Record the reason in the action prompt/API payload.
5. Verify the item is absent from the public resource library.
6. Open `History` and confirm an audit entry with actor, timestamp, and diff is present.

## Bulk Rollback
1. Select affected items.
2. Choose `Restore` or `Publish`.
3. Click `Preview Bulk Action` and confirm every item is valid.
4. Click `Execute Preview`.
5. Verify the success count and spot-check the public catalog.

## Safety Rules
- Never execute a bulk lifecycle action without a valid preview.
- Treat `delete` as a soft lifecycle state, not physical removal.
- Use `History` before restoring content to verify the previous state and reason for takedown.
- Use `archive` for semester rollover and `delete` only for unsafe or duplicate content.
