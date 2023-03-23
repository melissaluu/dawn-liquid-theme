if (!customElements.get('product-form')) {
  customElements.define('product-form', class ProductForm extends HTMLElement {
    constructor() {
      super();

      this.form = this.querySelector('form');
      this.form.querySelector('[name=id]').disabled = false;
      this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
      this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
      this.submitButton = this.querySelector('[type="submit"]');
      if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');
    }

    onSubmitHandler(evt) {
      evt.preventDefault();
      if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

      this.handleErrorMessage();

      this.submitButton.setAttribute('aria-disabled', true);
      this.submitButton.classList.add('loading');
      this.querySelector('.loading-overlay__spinner').classList.remove('hidden');

      const formData = new FormData(this.form);
      const sections = this.cart.getSectionsToRender().map((section) => section.id);
      const sectionsUrl =  window.location.pathname;
      

    //  if (window.UseStorefrontAPI()) {

      const formDataObject = [...formData.entries()].reduce((acc, item) => {
        // NOTE: Need to transform the Liquid syntax for item attributes (i.e. properties) to SFAPI format
        if(item[0].includes('properties[')) {
          const propName = item[0].match(/\[(.*)\]/)[1];
          if (typeof item[1] === 'string' && item[1].length > 0) {
            acc.attributes.push({
              key: propName,
              value: item[1]
            });
          }
        } else {
          acc[item[0]] = item[1];
        }
        return acc;
      }, {attributes: []});

      const merchandiseId = `gid://shopify/ProductVariant/${formDataObject.id}`;
      const sellingPlanId = formDataObject.selling_plan ? `gid://shopify/SellingPlan/${formDataObject.selling_plan}` : null;

      const lines = [{
        merchandiseId,
        quantity: parseInt(formDataObject.quantity, 10),
        attributes: formDataObject.attributes,
        sellingPlanId
      }];

      const {operationName, operation, variables} = window.SFAPIClient.getAddToCartConfig(lines);

      const startTime = Date.now();
      // window.SFAPIClient.fetchData(operation, variables)
      // .then(response => { return response.json()})
      window.SFAPIClient.client.fetch({operation, variables})
      .then(response => {

        console.log(response)
        // NOTE: Double layer error handling needed when using GQL
        if (response.error) {
          throw new Error(response.error)
        };
        
        const {data: {[operationName]: {cart, userErrors}}} = response;

        if (userErrors.length > 0) {
          this.handleErrorMessage(JSON.stringify(userErrors));

          const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
            if (!soldOutMessage) return;
            this.submitButton.setAttribute('aria-disabled', true);
            this.submitButton.querySelector('span').classList.add('hidden');
            soldOutMessage.classList.remove('hidden');
            this.error = true;
          return;
        }         
        this.error = false;
        
        window.SFAPIClient.setCartIDCookie(cart);
        console.log('cart122', cart);
        return cart;
      })
      .then((response) => {
        // NOTE: Need to get all cart lines to find the right cartline id to display
        return window.SFAPIClient.getAllCartLineItems(response)
      })
      .then((response) => {
        // NOTE: Need to find the updated cart line's id - will be used when in cart pop up
        this.cartLine = response.find((item) => {
          const hasSameSellingPlanId = sellingPlanId && item.sellingPlanAllocation ? 
            item.sellingPlanAllocation.sellingPlan.id === sellingPlanId : 
            true;
          return item.merchandise.id === merchandiseId 
            && hasSameSellingPlanId
            && JSON.stringify(formDataObject.attributes) == JSON.stringify(item.attributes) // cheating - I know
        });
      })
      .then(() => {
        return fetch(`${sectionsUrl}?sections=${sections.join()}`)
      })
      .then((response) => {
        return response.json();
      })
      .then((response) => {
        console.log('response', response)
        const parsedState = {key: this.cartLine, sections: response};
        const quickAddModal = this.closest('quick-add-modal');

        if (quickAddModal) {
          document.body.addEventListener('modalClosed', () => {
            setTimeout(() => { this.cart.renderContents(parsedState) });
          }, { once: true });
          quickAddModal.hide(true);
        } else {
          console.log('inside', parsedState)
          this.cart.renderContents(parsedState);
        }
      })
      .catch((error) => {
        console.error('Error:', error);
      })
      .finally(() => {
        this.submitButton.classList.remove('loading');
        if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
        if (!this.error) this.submitButton.removeAttribute('aria-disabled');
        this.querySelector('.loading-overlay__spinner').classList.add('hidden');
        console.log(`SFAPI add to cart time: ${Math.floor(Date.now() - startTime)}ms`);
      }); 

      //  return;
    //  }


      // if (this.cart) {
      //   formData.append('sections', sections);
      //   formData.append('sections_url', sectionsUrl);
      //   this.cart.setActiveElement(document.activeElement);
      // }

      // console.log(formData)
      // const config = fetchConfig('javascript');
      // config.headers['X-Requested-With'] = 'XMLHttpRequest';
      // delete config.headers['Content-Type'];
      // config.body = formData;

      // const startTime = Date.now();
      // fetch(`${routes.cart_add_url}`, config)
      //   .then((response) => response.json())
      //   .then((response) => {
      //     if (response.status) {
      //       this.handleErrorMessage(response.description);

      //       const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
      //       if (!soldOutMessage) return;
      //       this.submitButton.setAttribute('aria-disabled', true);
      //       this.submitButton.querySelector('span').classList.add('hidden');
      //       soldOutMessage.classList.remove('hidden');
      //       this.error = true;
      //       return;
      //     } else if (!this.cart) {
      //       window.location = window.routes.cart_url;
      //       return;
      //     }

      //     this.error = false;
      //     const quickAddModal = this.closest('quick-add-modal');
      //     if (quickAddModal) {
      //       document.body.addEventListener('modalClosed', () => {
      //         setTimeout(() => { this.cart.renderContents(response) });
      //       }, { once: true });
      //       quickAddModal.hide(true);
      //     } else {
      //       this.cart.renderContents(response);
      //     }
      //   })
      //   .catch((e) => {
      //     console.error(e);
      //   })
      //   .finally(() => {
      //     this.submitButton.classList.remove('loading');
      //     if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
      //     if (!this.error) this.submitButton.removeAttribute('aria-disabled');
      //     this.querySelector('.loading-overlay__spinner').classList.add('hidden');
      //     console.log(`Ajax add to cart time: ${Math.floor(Date.now() - startTime)}ms`);
      //   });
    }

    handleErrorMessage(errorMessage = false) {
      this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
      if (!this.errorMessageWrapper) return;
      this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

      this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

      if (errorMessage) {
        this.errorMessage.textContent = errorMessage;
      }
    }
  });
}
