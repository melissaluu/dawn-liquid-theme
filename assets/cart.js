class CartRemoveButton extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    
    this.lineItemStatusElement = document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    this.currentItemCount = Array.from(this.querySelectorAll('[name="updates[]"]'))
      .reduce((total, quantityInput) => total + parseInt(quantityInput.value), 0);

    this.debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300);

    this.addEventListener('change', this.debouncedOnChange.bind(this));
  }

  onChange(event) {
    this.updateQuantity(event.target.dataset, event.target.value, document.activeElement.getAttribute('name'));
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section'
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section'
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity({index: line, lineId}, quantity, name) {
    this.enableLoading(line);

    const sections = this.getSectionsToRender().map((section) => section.section);
    const sectionsUrl = window.location.pathname;

    if (window.UseStorefrontAPI()) {

      let startTime = 0;
      const sfapiCartId = window.SFAPIClient.getCartId();

      window.SFAPIClient.client.fetch({operation: window.SFAPIClient.operations.CART_QUERY, variables: {id: sfapiCartId}})
        .then(response => { return response.json()})
        .then(response => {
          const {id, quantity} = response.data.cart.lines.edges[0].node;
          this.lineId = id;

          const variables = {
            id: sfapiCartId,
            lines: [{
              id,
              quantity: quantity > 5 ? quantity - 1 : quantity + 1,
            }],
          };

          startTime = Date.now();
          return window.SFAPIClient.client.fetch({operation: window.SFAPIClient.operations.UPDATE_LINES, variables})
        })
        .then(response => { return response.json()})
        .then((response) => {
          this.cart = response.data.cartLinesUpdate.cart;

          // NOTE: order of sections seems to affect whether section rendering api returns values (had to reorder for this to work)
          // There seems to be an issue with 'main-cart-items' and it will block other sections to be returned 
          return fetch(`${sectionsUrl}?sections=${sections.join()}`)
        })
        .then((response) => {
          return response.json();
        })
        .then(response => {
          const {totalQuantity} = this.cart;
          const isEmptyCart = totalQuantity === 0;

          this.classList.toggle('is-empty', isEmptyCart);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', isEmptyCart);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', isEmptyCart);

          this.getSectionsToRender().forEach((section => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
            elementToReplace.innerHTML =
              this.getSectionInnerHTML(response[section.section], section.selector);
          }));
  
          this.updateLiveRegions(line, totalQuantity);
          const lineItem =  document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`)) : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (isEmptyCart && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'))
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'))
          }

          this.disableLoading();
        })
        .catch(() => {
          this.querySelectorAll('.loading-overlay').forEach((overlay) => overlay.classList.add('hidden'));
          const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
          errors.textContent = window.cartStrings.error;
          this.disableLoading();
        })
        .finally(() => {
          console.log(`SFAPI cart update time: ${Math.floor(Date.now() - startTime)}ms`);
        });

      return;
    }



    const body = JSON.stringify({
      line,
      quantity,
      sections,
      sections_url: sectionsUrl 
    });

    const startTime = Date.now();
    fetch(`${routes.cart_change_url}`, {...fetchConfig(), ...{ body }})
      .then((response) => {
        return response.json();
      })
      .then((state) => {
        const parsedState = state // JSON.parse(state);
        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          elementToReplace.innerHTML =
            this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
        }));

        this.updateLiveRegions(line, parsedState.item_count);
        const lineItem =  document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`)) : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'))
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'))
        }
        this.disableLoading();
      }).catch(() => {
        this.querySelectorAll('.loading-overlay').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
        this.disableLoading();
      })
      .finally(() => {
        console.log(`Ajax line update time: ${Math.floor(Date.now() - startTime)}ms`);
      });
  }

  updateLiveRegions(line, itemCount) {
    if (this.currentItemCount === itemCount) {
      const lineItemError = document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
      const quantityElement = document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);

      lineItemError
        .querySelector('.cart-item__error-text')
        .innerHTML = window.cartStrings.quantityError.replace(
          '[quantity]',
          quantityElement.value
        );
    }

    this.currentItemCount = itemCount;
    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus = document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading-overlay`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading-overlay`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading() {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define('cart-note', class CartNote extends HTMLElement {
    constructor() {
      super();

      this.addEventListener('change', debounce((event) => {

        const startTime = Date.now();
        
        if (window.UseStorefrontAPI()) {
          const sfapiCartId = window.SFAPIClient.getCartId();
          window.SFAPIClient.client.fetch({operation: window.SFAPIClient.operations.UDATE_NOTE, variables: {id: sfapiCartId, note: event.target.value}})
          .catch((error) => {
            console.log('Update note error: ', error);
          })
          .finally(() => {
            console.log(`Ajax note update time: ${Math.floor(Date.now() - startTime)}ms`);
          });

          return;
        }

        const body = JSON.stringify({ note: event.target.value });
        fetch(`${routes.cart_update_url}`, {...fetchConfig(), ...{ body }})
        .finally(() => {
          console.log(`Ajax note update time: ${Math.floor(Date.now() - startTime)}ms`);
        });
      }, 300))
    }
  });
};
