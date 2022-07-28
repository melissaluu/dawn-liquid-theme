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
      

     if (window.UseStorefrontAPI()) {
      const sfapiCartId = window.StorefrontAPIClient.getCartId();


      const formDataObject = [...formData.entries()].reduce((acc, item) => {
        // Need to transform the Liquid syntax for item attributes (i.e. properties) to SFAPI format
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

      console.log('cart id', sfapiCartId)
      console.log('form object', formDataObject)

      const merchandiseId = `gid://shopify/ProductVariant/${formDataObject.id}`;

      const lines = [{
        merchandiseId,
        quantity: parseInt(formDataObject.quantity, 10),
        attributes: formDataObject.attributes,
      }];

      const cartId = window.StorefrontAPIClient.getCartId();

      const operation = cartId ? 
        window.StorefrontAPIClient.operations.ADD_LINES :
        window.StorefrontAPIClient.operations.CART_CREATE_MUTATION;

      const variables = cartId ? {id: cartId, lines} : {input: {lines}};
      const operationName = cartId ? 'cartLinesAdd' : 'cartCreate';


      window.StorefrontAPIClient.fetchData(operation, variables)
      .then(response => { return response.json()})
      .then(response => {
        if (response.error) {
          throw new Error(response.error)
        };
        
        const {data: {[operationName]: {cart, userErrors}}} = response;
        if (userErrors.length > 0) {
          console.log(userErrors)
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
        
        document.cookie=`${window.StorefrontAPIClient.CART_COOKIE_NAME}=${cart.id}`
        console.log('cart response', cart, userErrors);
        return cart;
      })
      .then((response) => {
        // Need to get all cart lines to find the right cartline id to display
        return window.StorefrontAPIClient.getAllCartLineItems(response)
      })
      .then((response) => {
        console.log('final cartLines', response)
        // THIS DOES NOT ACCOUNT FOR SALES PLANS
        this.cartLineId = response.find((item) => {
          return item.merchandise.id === merchandiseId 
            && JSON.stringify(formDataObject.attributes) == JSON.stringify(item.attributes) // cheating - I know
        }).id;
      })
      .then(() => {
        return fetch(`${sectionsUrl}?sections=${sections.join()}`)
      })
      .then((response) => {
        return response.json();
      })
      .then((response) => {
        // const parsedState = {key: this.cartLineId, sections: response};
        //   const quickAddModal = this.closest('quick-add-modal');
        // if (quickAddModal) {
        //   console.log('in modal')
        //   document.body.addEventListener('modalClosed', () => {
        //     setTimeout(() => { this.cart.renderContents(parsedState) });
        //   }, { once: true });
        //   quickAddModal.hide(true);
        // } else {
        //   console.log('in cart', parsedState)
        //   this.cart.renderContents(parsedState);
        // }
      })
      .catch((error) => {
        console.error('Error:', error);
      })
      .finally(() => {
        this.submitButton.classList.remove('loading');
        if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
        if (!this.error) this.submitButton.removeAttribute('aria-disabled');
        this.querySelector('.loading-overlay__spinner').classList.add('hidden');
      });
      
      // console.log('form data', formDataObject, cartInput)

      // const query = window.StorefrontAPIClient.operations.CART_QUERY;

      // window.StorefrontAPIClient.fetchData(query, {id: 'gid://shopify/Cart/3167a499d2ca24f5743149958f439dff'})
      //   .then(response => { return response.json()})
      //   .then(response => {
      //     console.log('sfapi response', response);
      //   })
      //   .then(() => {

      //   })
      //   .catch((error) => {
      //     console.error('Error:', error);
      //   });
      
      

       return;
     }

      
    //  let formData1 = {
    //   'items': [{
    //    'id': 13650895011896,
    //    'quantity': 2,
    //    'properties': {
    //     'engraving': 'test'
    //    }
    //    }],
    //    'sections': ['cart-notification-product','cart-notification-button','cart-icon-bubble']
    //  };

      //  fetch(window.Shopify.routes.root + 'cart/add.js', {
      //    method: 'POST',
      //    headers: {
      //      'Content-Type': 'application/json'
      //    },
      //    body: JSON.stringify(formData1)
      //  })
      //  .then(response => {
      //    return response.json();
      //  })
      //  .then((response) => {
      //   console.log('cart/add.js', response)
      //  })
      //  .catch((error) => {
      //    console.error('Error:', error);
      //  });

      //  fetch(window.Shopify.routes.root + 'cart/update.js', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     attributes: {
      //       'attr1': 'cart attribute 1',
      //       '__private_attr': 'cart private attribute'
      //     },
      //     'sections': ['cart-notification-product','cart-notification-button','cart-icon-bubble']
      //   })
      // })
      // .then(response => {
      //   return response.json();
      // })
      // .then((response) => {
      //  console.log('update.js', response)
      // })

      //  fetch(window.Shopify.routes.root + 'cart/change.js', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     'line': 1,
      //     'quantity': 3,
      //     'sections': ['cart-notification-product','cart-notification-button','cart-icon-bubble']
      //   })
      // })
      // .then(response => {
      //   return response.json();
      // })
      // .then((response) => {
      //  console.log('change.js', response)
      // })
      
      // fetch(window.Shopify.routes.root + 'cart/clear.js', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   }
      // })
      // .then(response => {
      //   return response.json();
      // })
      // .then((response) => {
      //  console.log('clear.js', response)
      // });
      
      // fetch(window.Shopify.routes.root + 'cart.js', {
      //     method: 'GET',
      //     headers: {
      //       'Content-Type': 'application/json'
      //     }
      // }).then(response => {
      //   return response.json();
      // })
      // .then((response) => {
      //  console.log('cart.js', response)
      // })
      // .catch((error) => {
      //   console.error('Error:', error);
      // });

      if (this.cart) {
        formData.append('sections', sections);
        formData.append('sections_url', sectionsUrl);
        this.cart.setActiveElement(document.activeElement);
      }

      const config = fetchConfig('javascript');
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete config.headers['Content-Type'];
      config.body = formData;

      fetch(`${routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          console.log("response", response)
          if (response.status) {
            this.handleErrorMessage(response.description);

            const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
            if (!soldOutMessage) return;
            this.submitButton.setAttribute('aria-disabled', true);
            this.submitButton.querySelector('span').classList.add('hidden');
            soldOutMessage.classList.remove('hidden');
            this.error = true;
            return;
          } else if (!this.cart) {
            window.location = window.routes.cart_url;
            return;
          }

          this.error = false;
          const quickAddModal = this.closest('quick-add-modal');
          if (quickAddModal) {
            document.body.addEventListener('modalClosed', () => {
              setTimeout(() => { this.cart.renderContents(response) });
            }, { once: true });
            quickAddModal.hide(true);
          } else {
            this.cart.renderContents(response);
          }
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          this.submitButton.classList.remove('loading');
          if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
          if (!this.error) this.submitButton.removeAttribute('aria-disabled');
          this.querySelector('.loading-overlay__spinner').classList.add('hidden');
        });
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
