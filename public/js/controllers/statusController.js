/**
 * Status page controller.
 */
angular.module('BibBox').controller('StatusController', [
  '$scope', '$location', '$translate', '$timeout', 'userService', 'receiptService', 'Idle', '$modal', 'proxyService',
  function ($scope, $location, $translate, $timeout, userService, receiptService, Idle, $modal, proxyService) {
    "use strict";

    $scope.loading = true;

    // Check that the user is logged in.
    if (!userService.userLoggedIn()) {
      $location.path('/');
      return;
    }

    // Restart idle service if not running.
    Idle.watch();

    $scope.$on('IdleWarn', function (e, countdown) {
      $scope.$apply(function () {
        $scope.countdown = countdown;
      });
    });

    $scope.$on('IdleTimeout', function () {
      $scope.$evalAsync(function () {
        $location.path('/');
      });
    });

    $scope.$on('IdleEnd', function () {
      $scope.$apply(function () {
        $scope.countdown = null;
      });
    });

    $scope.materials = [];
    $scope.fineItems = [];
    $scope.currentPatron = null;

    // Load materials for currrent user.
    userService.patron().then(
      function (patron) {
        $scope.loading = false;

        console.log(patron);

        $scope.currentPatron = patron;

        $scope.fineItems = patron.fineItems;

        // If patron exists, get all charged, overdue and recall items.
        if (patron) {
          var i, item;

          // Add charged items.
          for (i = 0; i < patron.chargedItems.length; i++) {
            item = angular.copy(patron.chargedItems[i]);
            $scope.materials.push(item);
          }

          // Add overdue items.
          for (i = 0; i < patron.overdueItems.length; i++) {
            for (var j = 0; j < $scope.materials.length; j++) {
              if ($scope.materials[j].id === patron.overdueItems[i].id) {
                $scope.materials[j].overdue = true;
                $scope.materials[j].information = 'status.overdue';
              }
            }
          }

          // Add fines to items.
          for (i = 0; i < patron.fineItems.length; i++) {
            for (var j = 0; j < $scope.materials.length; j++) {
              if ($scope.materials[j].id === patron.fineItems[i].id) {
                $scope.materials[j].fineItem = patron.fineItems[i];
                break;
              }
            }
          }
        }
        else {
          // @TODO: Report error
          console.log(err);
        }
      },
      function (err) {
        // @TODO: Report error
        console.log(err);
      }
    );

    /**
     * Renew a material.
     *
     * @param material
     */
    $scope.renew = function renew(material) {
      material.loading = true;

      userService.renew(material.id).then(
        function success(data) {
          material.loading = false;
          console.log(data);

          if (!data) {
            material.information = 'status.renew.failed';
            material.renewed = false;
            return;
          }

          if (data.renewalOk === 'Y') {
            material.newDate = data.dueDate;
            material.overdue = false;
            material.information = "status.renew.ok";
          }
          else {
            material.information = data.screenMessage;
            material.renewed = false;
          }
        },
        function error(err) {
          material.loading = false;
          material.information = 'status.renew.failed';
          material.renewed = false;
          console.log(err);
        }
      );
    };

    /**
     * Renew all materials.
     */
    $scope.renewAll = function renewAll() {
      for (var i = 0; i < $scope.materials.length; i++) {
        $scope.materials[i].loading = true;
      }

      userService.renewAll().then(
        function success(data) {
          console.log(data);

          if (data.ok === '1') {
            // Update renewed items.
            if (data.renewedItems !== null) {
              for (var i = 0; i < data.renewedItems; i++) {
                for (var material in $scope.materials) {
                  material = $scope.materials[material];

                  if (material.id === data.renewedItems[i].id) {
                    material.loading = false;
                    material.information = 'status.renew.ok';
                    material.overdue = false;
                    material.renewed = true;
                    break;
                  }
                }
              }
            }

            // Update unrenewed items.
            if (data.unrenewedItems !== null) {
              for (var i = 0; i < data.unrenewedItems.length; i++) {
                for (var material in $scope.materials) {
                  material = $scope.materials[material];

                  if (material.id === data.unrenewedItems[i].id) {
                    material.loading = false;
                    material.information = data.unrenewedItems[i].reason;
                    material.renewed = false;
                    break;
                  }
                }
              }
            }
          }
          else {
            for (var material in $scope.materials) {
              material = $scope.materials[material];
              material.loading = false;
              material.information = 'status.renew.failed';
              material.renewed = false;
            }
          }
        },
        function error(err) {
          // @TODO: Handle error!
          console.log(err);
        }
      );
    };

    /**
     * Setup fines modal.
     */
    var finesModal = $modal({scope: $scope, templateUrl: './views/modal_fines.html', show: false });
    $scope.showFinesModal = function() {
      finesModal.$promise.then(finesModal.show);
    };

    /**
     * Setup receipt modal.
     */
    var receiptModal = $modal({scope: $scope, templateUrl: './views/modal_receipt.html', show: false });
    $scope.showReceiptModal = function() {
      receiptModal.$promise.then(receiptModal.show);
    };

    /**
     * Print receipt.
     *
     * @param type
     *   'mail' or 'printer'
     */
    $scope.receipt = function receipt(type) {
      var credentials = userService.getCredentials();

      // @TODO: handel error etc.
      receiptService.status(credentials.username, credentials.password, type)
      .then(
        function (status) {
          alert('mail sent');
        },
        function (err) {
          alert(err);
        }
      );
    };

    /**
     * Goto to front page.
     */
    $scope.gotoFront = function gotoFront() {
      userService.logout();
      $location.path('/');
    };

    /**
     * On destroy.
     *
     * Log out of user service.
     */
    $scope.$on("$destroy", function () {
      proxyService.cleanup();
      userService.logout();
      receiptModal.hide();
      finesModal.hide();
    });
  }
]);
