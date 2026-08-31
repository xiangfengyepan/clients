import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";

import { buildVaultTree, getNestedFolderTree, VaultTree } from "../utils/vault-tree";

import { VaultPopupItemsService } from "./vault-popup-items.service";

/**
 * Builds the folder/collection tree for the currently filtered vault items.
 */
@Injectable({ providedIn: "root" })
export class VaultPopupTreeService {
  private readonly accountService = inject(AccountService);
  private readonly collectionService = inject(CollectionService);
  private readonly folderService = inject(FolderService);
  private readonly organizationService = inject(OrganizationService);
  private readonly i18nService = inject(I18nService);
  private readonly vaultPopupItemsService = inject(VaultPopupItemsService);

  /** The filtered vault items, grouped into folders (personal) and collections (organization). */
  readonly vaultTree$: Observable<VaultTree> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      combineLatest([
        this.vaultPopupItemsService.filteredCiphers$,
        this.folderService.folderViews$(userId),
        this.collectionService.decryptedCollections$(userId),
        this.organizationService.memberOrganizations$(userId),
      ]),
    ),
    map(([ciphers, folders, collections, organizations]) =>
      buildVaultTree({
        ciphers,
        // `folderViews$` includes a placeholder entry for "no folder", which is represented in the
        // tree by items sitting directly in their parent node instead.
        folders: getNestedFolderTree(folders.filter((f) => !!f.id)),
        collections: this.collectionService.getAllNested(collections),
        organizations: [...organizations].sort(Utils.getSortFunction(this.i18nService, "name")),
        myVaultLabel: this.i18nService.t("myVault"),
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
