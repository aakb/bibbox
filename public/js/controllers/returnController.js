/**
 * @file
 * Return page controller.
 *
 * @extends RFIDBaseController
 * @implements RFIDBaseInterface
 */

angular.module('BibBox').controller('ReturnController', [
  '$scope', '$controller', '$location', '$timeout', 'userService', 'receiptService', 'config', '$modal',
  function ($scope, $controller, $location, $timeout, userService, receiptService, config, $modal) {
    'use strict';

    // Instantiate/extend base controller.
    $controller('RFIDBaseController', {$scope: $scope});

    if (!config || !config.binSorting) {
      $scope.baseLogoutRedirect('/');
      return;
    }

    // Display more than one book.
    $scope.imageDisplayMoreBooks = config.display_more_materials;

    // Store raw check-in responses as it's need to print receipt.
    var raw_materials = {};

    // Used for offline storage.
    var currentDate = new Date().getTime();

    // Materials that have been borrowed, but not been unlocked.
    $scope.lockedMaterials = [];

    // Get the return bins.
    $scope.returnBins = config.binSorting.destinations;

    // Setup bins.
    for (var bin in $scope.returnBins) {
      $scope.returnBins[bin].materials = [];
      $scope.returnBins[bin].pager = {
        itemsPerPage: 11,
        currentPage: 1
      };
    }

    /**
     * Handle tag detected.
     *
     * Attempts to check-in the material if all part are available and on device.
     *
     * @param tag
     *   The tag of material to check-in (return).
     */
    $scope.tagDetected = function tagDetected(tag) {
      var material = $scope.addTag(tag, $scope.materials);

      // Restart idle timeout.
      $scope.baseResetIdleWatch();

      // If afi is awaiting being locked, and is placed on the device again.
      // Retry the locking.
      if (material.status === 'awaiting_afi') {
        material.loading = true;

        $scope.setAFI(tag.uid, true);

        return;
      }

      // Check if all tags in series have been added.
      if (!material.invalid && !material.loading && !material.success && $scope.allTagsInSeries(material)) {
        // If a tag is missing from the device, do not attempt to return the material.
        if ($scope.anyTagRemoved(material.tags)) {
          return;
        }

        // Set the material to loading.
        material.loading = true;

        // Attempt to return the material.
        userService.checkIn(material.id, currentDate).then(
          function success(result) {
            $scope.baseResetIdleWatch();

            // Find material.
            var material = $scope.materials.find(function (material) {
              return material.id === result.itemIdentifier;
            });

            // If it is not found, ignore it.
            if (!material) {
              return;
            }

            // Check that the result exists.
            if (result) {
              // If the return was successful.
              if (result.ok === '1') {
                material.title = result.itemProperties.title;
                material.author = result.itemProperties.author;
                material.status = 'awaiting_afi';
                material.information = 'return.is_awaiting_afi';
                material.sortBin = result.sortBin;

                // Add to locked materials.
                $scope.lockedMaterials.push(material);

                // Turn AFI on.
                for (var i = 0; i < material.tags.length; i++) {
                  $scope.setAFI(material.tags[i].uid, true);
                }

                // If a tag is missing from the device show the unlocked materials pop-up.
                if ($scope.anyTagRemoved(material.tags)) {
                  tagMissingModal.$promise.then(tagMissingModal.show);

                  // Reset time to double time for users to has time to react.
                  $scope.baseResetIdleWatch(config.timeout.idleTimeout);
                }

                // Store the raw result (it's used to send with receipts).
                if (result.hasOwnProperty('patronIdentifier')) {
                  if (!raw_materials.hasOwnProperty(result.patronIdentifier)) {
                    raw_materials[result.patronIdentifier] = [];
                  }

                  raw_materials[result.patronIdentifier].push(result);
                }
                else {
                  if (!raw_materials.hasOwnProperty('unknown')) {
                    raw_materials.unknown = [];
                  }
                  raw_materials.unknown.push(result);
                }
              }
              else {
                material.loading = false;
                material.information = result.screenMessage;
                material.status = 'error';
              }
            }
            else {
              material.status = 'error';
              material.information = 'return.was_not_successful';
              material.loading = false;
            }
          },
          function error(err) {
            $scope.baseResetIdleWatch();

            console.error('Return error', err);

            for (i = 0; i < $scope.materials.length; i++) {
              if ($scope.materials[i].id === material.id) {
                material = $scope.materials[i];

                material.status = 'error';
                material.information = 'return.was_not_successful';
                material.loading = false;

                break;
              }
            }
          }
        );
      }
    };

    /**
     * Tag was removed from RFID device.
     *
     * @param tag
     */
    $scope.tagRemoved = function itemRemoved(tag) {
      // Restart idle timeout.
      $scope.baseResetIdleWatch();

      // Check if material has already been added to the list.
      var material = $scope.materials.find(function (material) {
        return material.id === tag.mid;
      });

      // If the material has not been added, ignore it.
      if (!material) {
        return;
      }

      // Mark tag as removed from the scanner.
      var materialTag = material.tags.find(function (tag) {
        return tag.uid === tag.uid;
      });

      // If the tag is found, mark it as removed.
      if (materialTag) {
        materialTag.removed = true;
      }

      if (material.status === 'awaiting_afi') {
        tagMissingModal.$promise.then(tagMissingModal.show);

        // Reset time to double time for users to has time to react.
        $scope.baseResetIdleWatch(config.timeout.idleTimeout);
      }
    };

    /**
     * Tag AFI has been set.
     *
     * Called from RFIDBaseController.
     *
     * @param tag
     *   The tag returned from the device.
     */
    $scope.tagAFISet = function itemAFISet(tag) {
      var material = $scope.updateMaterialAFI(tag);

      // If the tag belongs to a material in $scope.materials.
      if (material) {
        // Iterate all tags in material and return tag if afi is not true.
        var found = material.tags.find(function (tag) {
          return !tag.afi;
        });

        // If all AFIs have been turned on mark the material as returned.
        if (!found) {
          // Place the material in the correct sorting bin.
          var returnBin = getSortBin(material.sortBin);

          // See if material was already added to borrowed materials.
          found = returnBin.materials.find(function (item) {
            return item.id === material.id;
          });

          // Add to material to return bin.
          if (!found) {
            returnBin.materials.push(material);

            // Update the pager to show latest result.
            returnBin.pager.currentPage = Math.ceil(returnBin.materials.length / returnBin.pager.itemsPerPage);
          }

          // Remove material from lockedMaterials, if there.
          var index = $scope.lockedMaterials.indexOf(material);
          if (index !== -1) {
            $scope.lockedMaterials.splice(index, 1);
          }

          // Remove tagMissingModal if no materials are locked.
          if ($scope.lockedMaterials.length <= 0) {
            tagMissingModal.$promise.then(tagMissingModal.hide);
          }

          material.status = 'success';
          material.information = 'return.was_successful';
          material.loading = false;
          material.success = true;
        }
      }
    };

    /**
     * Get sort bin.
     *
     * @param {string} bin
     *   The bin number.
     *
     * @returns {*}
     *   The bin the material should be added to.
     */
    function getSortBin(bin) {
      if (config.binSorting.bins.hasOwnProperty(bin)) {
        return $scope.returnBins[config.binSorting.bins[bin]];
      }
      else {
        return $scope.returnBins[config.binSorting.default_bin];
      }
    }

    /**
     * Print receipt.
     */
    $scope.receipt = function receipt() {
      // Raw materials contains all loaned in the library system (also those who
      // have failed AFI sets, as they are still loaned in LMS)
      receiptService.returnReceipt(raw_materials, 'printer').then(
        function (status) {
          // Ignore.
        },
        function (err) {
          // @TODO: Report error to user.
          console.log(err);
        }
      );

      // Always return to front page.
      $scope.baseLogoutRedirect();
    };

    /**
     * Show the processing modal.
     */
    $scope.showProcessingModal = function showProcessingModal() {
      processingModal.$promise.then(processingModal.show);
    };

    /**
     * Setup processing modal.
     */
    var processingModal = $modal({
      scope: $scope,
      templateUrl: './views/modal_processing.html',
      show: false
    });

    /**
     * Setup tag missing modal.
     *
     * Has a locked backdrop, that does not disappear when clicked.
     */
    var tagMissingModal = $modal({
      scope: $scope,
      templateUrl: './views/modal_tag_missing.html',
      show: false,
      backdrop: 'static'
    });

    // Check that interface methods are implemented.
    Interface.ensureImplements($scope, RFIDBaseInterface);

    /**
     * On destroy.
     */
    $scope.$on('$destroy', function () {
      processingModal.hide();
      tagMissingModal.hide();
    });
  }
]);
