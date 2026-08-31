import { Injectable, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";

import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";

/** The layout used to render the vault item list in the popup. */
export const VaultViewMode = Object.freeze({
  /** A flat list of items, grouped by section (autofill suggestions, favorites, all items). */
  List: "list",
  /** A collapsible tree of folders (personal items) and collections (organization items). */
  Tree: "tree",
} as const);

export type VaultViewMode = UnionOfValues<typeof VaultViewMode>;

/**
 * Holds the vault list/tree view preference and the expanded state of individual tree nodes.
 *
 * State is intentionally in-memory only: it lives as long as the popup's root injector, so it
 * survives navigating between popup routes but resets when the popup is closed.
 */
@Injectable({ providedIn: "root" })
export class VaultPopupViewModeService {
  private readonly _viewMode = signal<VaultViewMode>(VaultViewMode.List);

  /** Ids of the tree nodes the user has collapsed. Nodes are expanded by default. */
  private readonly _collapsedNodeIds = signal<ReadonlySet<string>>(new Set());

  readonly viewMode = this._viewMode.asReadonly();
  readonly viewMode$ = toObservable(this._viewMode);

  setViewMode(mode: VaultViewMode): void {
    this._viewMode.set(mode);
  }

  toggleViewMode(): void {
    this._viewMode.update((mode) =>
      mode === VaultViewMode.List ? VaultViewMode.Tree : VaultViewMode.List,
    );
  }

  isNodeExpanded(nodeId: string): boolean {
    return !this._collapsedNodeIds().has(nodeId);
  }

  toggleNode(nodeId: string): void {
    this._collapsedNodeIds.update((collapsed) => {
      const next = new Set(collapsed);
      if (!next.delete(nodeId)) {
        next.add(nodeId);
      }
      return next;
    });
  }
}
