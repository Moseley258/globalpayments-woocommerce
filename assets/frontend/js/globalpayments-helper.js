(function (
	$,
	globalpayments_helper_params
) {
	function Helper( options ) {
		/**
		 * Helper options
		 *
		 * @type {object}
		 */
		this.helperOptions = options;

		/**
		 * The current order
		 *
		 * @type {object}
		 */
		this.order = options.order;

		this.attachEventHandlers();
	};

	Helper.prototype = {
		/**
		 * Add important event handlers for controlling the payment experience during checkout
		 *
		 * @returns
		 */
		attachEventHandlers: function () {
			$( document.body ).on( 'updated_checkout', this.getOrderInfo.bind( this ) );
		},

		/**
		 * Get order info
		 */
		getOrderInfo: function () {
			var self = this;
			self.blockOnSubmit();

			$.get( self.helperOptions.orderInfoUrl )
				.done( function( result ) {
					self.order = result.message;
				})
				.fail( function( jqXHR, textStatus, errorThrown ) {
					console.log(errorThrown);
				})
				.always( function() {
					self.unblockOnError();
				});
		},

		/**
		 * Convenience function to get CSS selector for the built-in 'Place Order' button
		 *
		 * @returns {string}
		 */
		getPlaceOrderButtonSelector: function () {
			return '#place_order';
		},

		/**
		 * Convenience function to get CSS selector for the custom 'Place Order' button's parent element
		 *
		 * @param {string} id
		 * @returns {string}
		 */
		getSubmitButtonTargetSelector: function ( id ) {
			return '#' + id + '-card-submit';
		},

		/**
		 * Convenience function to get CSS selector for the radio input associated with our payment method
		 *
		 * @returns {string}
		 */
		getPaymentMethodRadioSelector: function ( id ) {
			return '.payment_methods input.input-radio[value="' + id + '"]';
		},

		/**
		 * Convenience function to get CSS selector for stored card radio inputs
		 *
		 * @returns {string}
		 */
		getStoredPaymentMethodsRadioSelector: function ( id ) {
			return '.payment_method_' + id + ' .wc-saved-payment-methods input';
		},

		/**
		 * Swaps the default WooCommerce 'Place Order' button for our iframe-d button
		 * or digital wallet buttons when one of our gateways is selected.
		 *
		 * @returns
		 */
		toggleSubmitButtons: function () {
			var selectedPaymentGatewayId = $( '.payment_methods input.input-radio:checked' ).val();
			$( '.globalpayments.card-submit' ).hide();
			if ( this.helperOptions.hide.includes( selectedPaymentGatewayId ) ) {
				this.hidePlaceOrderButton();
				return;
			}
			if ( ! this.helperOptions.toggle.includes( selectedPaymentGatewayId ) ) {
				this.showPlaceOrderButton();
				return;
			}

			var submitButtonTarget = $( this.getSubmitButtonTargetSelector( selectedPaymentGatewayId ) );
			// stored Cards available (registered user selects stored card as payment method)
			var savedCardsAvailable    = $( this.getStoredPaymentMethodsRadioSelector( selectedPaymentGatewayId ) + '[value!="new"]' ).length > 0;
			// user selects (new) card as payment method
			var newSavedCardSelected   = 'new' === $( this.getStoredPaymentMethodsRadioSelector( selectedPaymentGatewayId ) + ':checked' ).val();
			// selected payment method is card or digital wallet
			if ( ! savedCardsAvailable  || savedCardsAvailable && newSavedCardSelected ) {
				submitButtonTarget.show();
				this.hidePlaceOrderButton();
			} else {
				// selected payment method is stored card
				submitButtonTarget.hide();
				this.showPlaceOrderButton();
			}
		},

		/**
		 * Hide the default WooCommerce 'Place Order' button.
		 */
		hidePlaceOrderButton: function() {
			$( this.getPlaceOrderButtonSelector() ).addClass( 'woocommerce-globalpayments-hidden' ).hide();
		},

		/**
		 * Show the default WooCommerce 'Place Order' button.
		 */
		showPlaceOrderButton: function() {
			$( this.getPlaceOrderButtonSelector() ).removeClass( 'woocommerce-globalpayments-hidden' ).show();
		},

		/**
		 * Gets the current checkout form
		 *
		 * @returns {Element}
		 */
		getForm: function () {
			var checkoutForms = [
				// Order Pay
				'form#order_review',
				// Checkout
				'form[name="checkout"]',
				// Add payment method
				'form#add_payment_method',
				// Admin Order Pay
				'form#wc-globalpayments-pay-order-form',
			];
			var forms = document.querySelectorAll( checkoutForms.join( ',' ) );

			return forms.item( 0 );
		},

		createInputElement: function ( id, name, value ) {
			var inputElement = ( document.getElementById( id + '-' + name ) );

			if ( ! inputElement ) {
				inputElement = document.createElement( 'input' );
				inputElement.id = id + '-' + name;
				inputElement.name = id + '[' + name + ']';
				inputElement.type = 'hidden';
				this.getForm().appendChild( inputElement );
			}

			inputElement.value = value;
		},

		/**
		 * Creates the parent for the submit button
		 *
		 * @returns
		 */
		createSubmitButtonTarget: function ( id ) {
			var el = document.createElement( 'div' );
			el.id = this.getSubmitButtonTargetSelector( id ).replace( '#', '' );
			el.className = 'globalpayments ' + id + ' card-submit';
			$( this.getPlaceOrderButtonSelector() ).after( el );
			// match the visibility of our payment form
			this.toggleSubmitButtons( id );
		},

		/**
		 * Places/submits the order to Woocommerce
		 *
		 * Attempts to click the default 'Place Order' button that is used by payment methods.
		 * This is to account for other plugins taking action based on that click event, even
		 * though there are usually better options. If anything fails during that process,
		 * we fall back to calling `this.placeOrder` manually.
		 *
		 * @returns
		 */
		placeOrder: function () {
			try {
				var originalSubmit = $( this.getPlaceOrderButtonSelector() );
				if ( originalSubmit ) {
					originalSubmit.click();
					return;
				}
			} catch ( e ) {
				/* om nom nom */
			}
			$( this.getForm() ).submit();
		},

		/**
		 * Shows payment error and scrolls to it
		 *
		 * @param {string} message Error message
		 *
		 * @returns
		 */
		showPaymentError: function ( message ) {
			var $form = $( this.getForm() );

			// Remove notices from all sources
			$( '.woocommerce-NoticeGroup, .woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-globalpayments-checkout-error' ).remove();

			if ( -1 === message.indexOf( 'woocommerce-error' ) ) {
				message = '<ul class="woocommerce-error"><li>' + message + '</li></ul>';
			}
			$form.prepend( '<div class="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout woocommerce-globalpayments-checkout-error">' + message + '</div>' );

			$( 'html, body' ).animate( {
				scrollTop: ( $form.offset().top - 100 )
			}, 1000 );

			this.unblockOnError();

			$( document.body ).trigger( 'checkout_error' );
		},

		/**
		 * Blocks checkout UI
		 *
		 * Implementation pulled from `woocommerce/assets/js/frontend/checkout.js`
		 *
		 * @returns
		 */
		blockOnSubmit: function () {
			var $form = $( this.getForm() );
			var form_data = $form.data();
			if ( 1 !== form_data['blockUI.isBlocked'] ) {
				$form.block(
					{
						message: null,
						overlayCSS: {
							background: '#fff',
							opacity: 0.6
						}
					}
				);
			}
		},

		/**
		 * Unblocks checkout UI
		 *
		 * @returns
		 */
		unblockOnError: function () {
			var $form = $( this.getForm() );
			$form.unblock();
		},

		hidePaymentMethod: function ( id ) {
			$( '.payment_method_' + id ).hide();
		}
	};

	if ( ! window.GlobalPaymentsHelper ) {
		window.GlobalPaymentsHelper = new Helper( globalpayments_helper_params );
	}
} (
	( window ).jQuery,
	( window ).globalpayments_helper_params || {}
) );
