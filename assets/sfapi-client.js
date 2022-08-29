const DEFAULT_SFAPI_VERSION = '2022-07';
const CART_COOKIE_NAME = 'c1-cart-id'; //'cart';
const LINE_NUM = '250';

const MONEY_FRAGMENT = `
  fragment MoneyFragment on MoneyV2 {
    amount
    currencyCode
  }
`;

const IMAGE_FRAGMENT = `
  fragment ImageFragment on Image {
    id
    url
    altText
    width
    height
  }
`;

const PAGE_INFO_FRAGMENT = `
  fragment PageInfoFragment on PageInfo {
    hasNextPage
    hasPreviousPage
  }
`;

const CART_QUERY = `query Cart(
  $id: ID!
  $country: CountryCode
) @inContext(country: $country) {
  cart(id: $id) {
    id
    createdAt
    updatedAt
    checkoutUrl
    buyerIdentity {
      countryCode
      customer {
        id
        email
        firstName
        lastName
        displayName
      }
      email
      phone
    }
    note
    attributes {
      key
      value
    }
    discountCodes {
      code
      applicable
    }
    ...CartLineFragment
    estimatedCost {
      subtotalAmount {
        ...MoneyFragment
      }
      totalAmount {
        ...MoneyFragment
      }
      totalDutyAmount {
        ...MoneyFragment
      }
      totalTaxAmount {
        ...MoneyFragment
      }
    }
  }
}

${MONEY_FRAGMENT}

${IMAGE_FRAGMENT}

${PAGE_INFO_FRAGMENT}


fragment SellingPlanAllocationFragment on SellingPlanAllocation {
  priceAdjustments {
    price {
      ...MoneyFragment
    }
    perDeliveryPrice {
      ...MoneyFragment
    }
    compareAtPrice {
      ...MoneyFragment
    }
    unitPrice {
      ...MoneyFragment
    }
  }
  sellingPlan {
    {
      id
      description
      name
      recurringDeliveries
      options {
        name
        value
      }
      priceAdjustments {
        orderCount
        adjustmentValue {
          ... on SellingPlanFixedAmountPriceAdjustment {
            adjustmentAmount {
              ...MoneyFragment
            }
          }
          ... on SellingPlanFixedPriceAdjustment {
            price {
              ...MoneyFragment
            }
          }
          ... on SellingPlanPercentagePriceAdjustment {
            adjustmentPercentage
          }
        }
      }
    }
  }
}

fragment CartLineFragment on Cart {
  lines(
    first: ${LINE_NUM}
  ) {
    pageInfo {
      ...PageInfoFragment
    }
    edges {
      cursor
      node {
        id
        quantity
        attributes {
          key
          value
        }
        estimatedCost {
          subtotalAmount {
            ...MoneyFragment
          }
          totalAmount {
            ...MoneyFragment
          }
        }
        discountAllocations {
          discountedAmount {
            ...MoneyFragment
          }
        }
        sellingPlanAllocation {
          ...SellingPlanAllocationFragment
        }
        merchandise {
          ...CartProductVariant
        }
      }
    }
  }
}

fragment CartProductVariant on ProductVariant {
  id
  title
  requiresShipping
  priceV2 {
    ...MoneyFragment
  }
  image {
    ...ImageFragment
  }
  product {
    handle
    title
  }
  selectedOptions {
    name
    value
  }
  compareAtPriceV2 {
    ...MoneyFragment
  }
  weight
  weightUnit
}
`;

const CART_LINES_FRAGMENT = `
  fragment CartLineFragment on Cart {
    lines(
      first: ${LINE_NUM}
      after: $after
    ) {
      pageInfo {
        ...PageInfoFragment
      }
      edges {
        cursor
        node {
          id
          attributes {
            key
            value
          }
          sellingPlanAllocation {
            sellingPlan {
              id
            }
          }
          merchandise {
            ... on ProductVariant {
              id
              title
            }
          }
        }
      }
    }
  }
`

const CART_LINES_QUERY = `query Cart(
  $id: ID!
  $after: String
) {
  cart(id: $id) {
    id
    ...CartLineFragment
  }
}

${PAGE_INFO_FRAGMENT}

${CART_LINES_FRAGMENT}
`;

const CART_USER_ERRORS_FRAGMENT = `
  fragment CartUserErrorsFragment on CartUserError {
    message
    code
    field
  }
`;

const CART_CREATE_MUTATION = `
  mutation CartCreate(
    $input: CartInput!
    $after: String
  ) {
    cartCreate(input: $input) {
      userErrors {
        ...CartUserErrorsFragment
      }
      cart{
        id
        ...CartLineFragment
      }
    }
  }

  ${CART_USER_ERRORS_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  ${CART_LINES_FRAGMENT}
`

const ADD_LINES = `
  mutation CartAddLines(
    $id: ID!
    $lines: [CartLineInput!]!
    $after: String
  ) {
    cartLinesAdd(cartId: $id, lines: $lines) {
      userErrors {
        ...CartUserErrorsFragment
      }
      cart {
        id
        ...CartLineFragment
      }
      
    }
  }

  ${CART_USER_ERRORS_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  ${CART_LINES_FRAGMENT}
`

const UPDATE_LINES = `
  mutation CartAddLines(
    $id: ID!
    $lines: [CartLineUpdateInput!]!
    $after: String
  ) {
    cartLinesUpdate(cartId: $id, lines: $lines) {
      userErrors {
        ...CartUserErrorsFragment
      }
      cart {
        id
        totalQuantity
        lines(
          first: ${LINE_NUM}
          after: $after
        ) {
          pageInfo {
            ...PageInfoFragment
          }
          edges {
            cursor
            node {
              id
              quantity
              attributes {
                key
                value
              }
            }
          }
        }
      }
    }
  }

  ${CART_USER_ERRORS_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
`

const UDATE_NOTE = `
  mutation updateCartNote($id: ID!, $note: String) {
    cartNoteUpdate(cartId: $id, note: $note) {
      cart {
        id
        note
      }
    }
  }
`;

function generateSFAPIFetchData(storefrontAPIVersion) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Shopify-Storefront-Access-Token': 'f8d666e5c7ea78ece514ec7c8a560be4',
    'X-SDK-Variant': 'storefront-api-online-store-client',
    'X-SDK-Version': storefrontAPIVersion,
    'X-SDK-Variant-Source': 'online-store'
  };

  // NOTE: need to figure out custom urls & cross site policies
  // const url = `${window.shopUrl}/api/${storefrontAPIVersion}/graphql`
  const url = `/api/${storefrontAPIVersion}/graphql`

  return (operation, variables = {}) => {
    const body = JSON.stringify({
      query: operation,
      variables,
    });

    const request = new Request(url, {
      method: 'POST',
      headers,
      body,
    });

    return fetch(request);
  }
}

function getCookie(name) {
  return document.cookie.split('; ').find(cookie => cookie.startsWith(`${name}=`))?.split('=')[1] || null;
}

function extractNodes(edges) {
  return edges.map((edge) => {
    return edge.node;
  })
}

function initStorefrontAPIClient(storefrontAPIVersion = DEFAULT_SFAPI_VERSION) {

  const fetchData = generateSFAPIFetchData(storefrontAPIVersion);

  const getNextCartLines = (cart, cartLines) => {
    const cursor = cart.lines.edges[cart.lines.edges.length - 1].cursor
    return fetchData(CART_LINES_QUERY, {id: cart.id, after: cursor})
      .then(response => { return response.json()})
      .then((response) => {
        const lines = [...cartLines, ...response.data.cart.lines.edges];

        if (response.data.cart.lines.pageInfo.hasNextPage) {
          return getNextCartLines(response.data.cart, lines)
        }

        return lines
      });  
  }

  const getAllCartLineItems = (cart) => {    
    if (cart.lines.pageInfo.hasNextPage) {
      return getNextCartLines(cart, [...cart.lines.edges])
      .then((response) => {
        return extractNodes(response);
      })
    }

    return extractNodes(cart.lines.edges);
  }

  const getCartId = () => {
    const rawId = getCookie(CART_COOKIE_NAME);
    return rawId ? rawId : null; //`gid://shopify/Cart/${rawId}` : null;
  }

  window.StorefrontAPIClient = {
    fetchData,
    getCartId,
    getAddToCartConfig(lines) {
      const cartId = getCartId();
      
      // NOTE: SFAPI has unique operation names to consider when parsing JSON response
      return {
        operation: cartId ? ADD_LINES : CART_CREATE_MUTATION,
        operationName: cartId ? 'cartLinesAdd' : 'cartCreate',
        variables: cartId ? {id: cartId, lines} : {input: {lines}},
      }
    },
    getAllCartLineItems,
    setCartIDCookie(cart) {
      document.cookie=`${window.StorefrontAPIClient.CART_COOKIE_NAME}=${cart.id};path=/`
    },
    CART_COOKIE_NAME,
    operations: {
      CART_QUERY,
      CART_CREATE_MUTATION,
      ADD_LINES,
      UPDATE_LINES,
      UDATE_NOTE
    }
  }
}

initStorefrontAPIClient();

window.UseStorefrontAPI = () => {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('useSFAPI') === 'true';
}