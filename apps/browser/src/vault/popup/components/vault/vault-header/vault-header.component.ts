// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, inject, NgZone, ViewChild } from "@angular/core";
import { combineLatest, map, take } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DisclosureComponent,
  DisclosureTriggerForDirective,
  IconButtonModule,
} from "@bitwarden/components";

import { runInsideAngular } from "../../../../../platform/browser/run-inside-angular.operator";
import { VaultPopupListFiltersService } from "../../../services/vault-popup-list-filters.service";
import {
  VaultPopupViewModeService,
  VaultViewMode,
} from "../../../services/vault-popup-view-mode.service";
import { VaultListFiltersComponent } from "../vault-list-filters/vault-list-filters.component";
import { VaultSearchComponent } from "../vault-search/vault-search.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-header",
  templateUrl: "vault-header.component.html",
  imports: [
    VaultSearchComponent,
    VaultListFiltersComponent,
    DisclosureComponent,
    IconButtonModule,
    DisclosureTriggerForDirective,
    CommonModule,
    JslibModule,
  ],
})
export class VaultHeaderComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(DisclosureComponent) disclosure: DisclosureComponent;

  /** Emits the visibility status of the disclosure component. */
  protected isDisclosureShown$ = this.vaultPopupListFiltersService.filterVisibilityState$.pipe(
    runInsideAngular(inject(NgZone)), // Browser state updates can happen outside of `ngZone`
    map((v) => v ?? true),
  );

  // Only use the first value to avoid an infinite loop from two-way binding
  protected initialDisclosureVisibility$ = this.isDisclosureShown$.pipe(take(1));

  protected numberOfAppliedFilters$ = this.vaultPopupListFiltersService.numberOfAppliedFilters$;

  /** Emits true when the number of filters badge should be applied. */
  protected showBadge$ = combineLatest([
    this.numberOfAppliedFilters$,
    this.isDisclosureShown$,
  ]).pipe(map(([numberOfFilters, disclosureShown]) => numberOfFilters !== 0 && !disclosureShown));

  protected buttonSupportingText$ = this.numberOfAppliedFilters$.pipe(
    map((numberOfFilters) => {
      if (numberOfFilters === 0) {
        return null;
      }
      if (numberOfFilters === 1) {
        return this.i18nService.t("filterApplied");
      }

      return this.i18nService.t("filterAppliedPlural", numberOfFilters);
    }),
  );

  private readonly configService = inject(ConfigService);
  private readonly viewModeService = inject(VaultPopupViewModeService);

  protected readonly VaultViewMode = VaultViewMode;

  /** Emits true when the list/tree view toggle is available. */
  protected readonly treeViewEnabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.VaultTreeViewInExtension,
  );

  protected readonly viewMode$ = this.viewModeService.viewMode$;

  constructor(
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private i18nService: I18nService,
  ) {}

  /** Switches the vault between the flat list and the folder tree. */
  toggleViewMode() {
    this.viewModeService.toggleViewMode();
  }

  async toggleFilters(isShown: boolean) {
    await this.vaultPopupListFiltersService.updateFilterVisibility(isShown);
  }
}
