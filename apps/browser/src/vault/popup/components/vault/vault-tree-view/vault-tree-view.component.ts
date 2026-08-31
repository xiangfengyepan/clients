import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { IconComponent, TypographyModule } from "@bitwarden/components";

import { VaultPopupTreeService } from "../../../services/vault-popup-tree.service";
import { VaultPopupViewModeService } from "../../../services/vault-popup-view-mode.service";
import { VaultTree } from "../../../utils/vault-tree";
import { VaultListItemsContainerComponent } from "../vault-list-items-container/vault-list-items-container.component";

const EMPTY_TREE: VaultTree = { nodes: [], ciphers: [] };

/**
 * Renders the filtered vault items as a collapsible tree of folders and collections.
 *
 * Item rendering is delegated to {@link VaultListItemsContainerComponent} so rows behave
 * identically in both the list and tree layouts.
 */
@Component({
  selector: "app-vault-tree-view",
  templateUrl: "vault-tree-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, TypographyModule, VaultListItemsContainerComponent],
})
export class VaultTreeViewComponent {
  private readonly vaultPopupTreeService = inject(VaultPopupTreeService);
  private readonly viewModeService = inject(VaultPopupViewModeService);

  protected readonly tree = toSignal(this.vaultPopupTreeService.vaultTree$, {
    initialValue: EMPTY_TREE,
  });

  protected expanded(nodeId: string): boolean {
    return this.viewModeService.isNodeExpanded(nodeId);
  }

  protected toggleNode(nodeId: string): void {
    this.viewModeService.toggleNode(nodeId);
  }
}
