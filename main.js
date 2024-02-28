document.addEventListener('DOMContentLoaded', () => {
    const cartList = document.getElementById('cart');
    const totalSpan = document.getElementById('total');
    const payButton = document.getElementById('pay-btn');
    const searchButton = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');

    let db;

    // Tuve que buscar una base de datos que soportara el guardado de numeros de facturas y no fuese localStorage.
    const request = window.indexedDB.open('invoicesDB', 1);

    request.onerror = function(event) {
        console.error('Error al abrir la base de datos:', event.target.errorCode);
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('Base de datos abierta correctamente');
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        const objectStore = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('email', 'email', { unique: false });
        objectStore.createIndex('phone', 'phone', { unique: false });
    };

    function fetchProducts() {
        fetch('https://fakestoreapi.com/products')
            .then(response => response.json())
            .then(products => {
                renderProducts(products);
            })
            .catch(error => {
                console.error('Error fetching products:', error);
            });
    }

    function renderProducts(products) {
        const itemList = document.getElementById('item-list');
        itemList.innerHTML = '';

        products.forEach(product => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div>
                    <img src="${product.image}" alt="${product.title}" style="width: 100px; height: 100px;">
                    <h3>${product.title}</h3>
                    <p>${product.description}</p>
                    <p>Precio: $${product.price}</p>
                    <p>Categoría: ${product.category}</p>
                    <button class="buy-btn" data-id="${product.id}" data-price="${product.price}">Comprar</button>
                </div>
            `;
            itemList.appendChild(listItem);
        });

        addEventListeners();
    }

    function addEventListeners() {
        const buyButtons = document.querySelectorAll('.buy-btn');
        buyButtons.forEach(button => {
            button.addEventListener('click', () => {
                const id = button.getAttribute('data-id');
                const price = parseInt(button.getAttribute('data-price'));
                const itemName = button.parentElement.querySelector('h3').textContent;
                const items = getItemsFromLocalStorage();

                items.push({ id: id, name: itemName, price: price });
                saveItemsToLocalStorage(items);
                updateCartView();
                swal("¡Producto agregado al carrito!", "", "success");
            });
        });
    }

    function getItemsFromLocalStorage() {
        return JSON.parse(localStorage.getItem('cartItems')) || [];
    }

    function saveItemsToLocalStorage(items) {
        localStorage.setItem('cartItems', JSON.stringify(items));
    }

    function updateCartView() {
        const items = getItemsFromLocalStorage();
        cartList.innerHTML = '';
        let total = 0;

        items.forEach(item => {
            const cartItem = document.createElement('li');
            cartItem.textContent = item.name + " - $" + item.price;
            cartList.appendChild(cartItem);
            total += item.price;
        });

        totalSpan.textContent = total;
    }

    payButton.addEventListener('click', () => {
        const items = getItemsFromLocalStorage();

        if (items.length === 0) {
            swal("Carrito vacío", "Agrega productos al carrito antes de pagar", "warning");
            return;
        }
    
        const customerName = document.getElementById('customer-name').value;
        const customerEmail = document.getElementById('customer-email').value;
        const customerPhone = document.getElementById('customer-phone').value;
    
        if (!customerName || !customerEmail || !customerPhone) {
            swal("Datos del cliente incompletos", "Por favor, ingrese todos los datos del cliente", "warning");
            return;
        }
    
        // Aca vino la parte extra que era crear la factura.
        const invoice = {
            name: customerName.toLowerCase(),
            email: customerEmail.toLowerCase(),
            phone: customerPhone.toLowerCase(),
            items: items,
            total: items.reduce((acc, item) => acc + item.price, 0),
            timestamp: new Date().toISOString()
        };
    

    


        saveInvoiceToDB(invoice);
    
        localStorage.removeItem('cartItems');
    
        updateCartView();
    
        const invoiceMessage = generateInvoiceMessage(invoice);
        swal("¡Compra realizada!", invoiceMessage, "success");
    });
    

    searchButton.addEventListener('click', () => {
        const query = searchInput.value;
        if (query.trim() !== '') {
            searchInvoice(query);
        } else {
            swal("Campo de búsqueda vacío", "Por favor, ingrese un nombre, correo electrónico o teléfono para buscar la factura", "warning");
        }
    });

    function generateInvoiceMessage(invoice) {
        let message = "¡Compra realizada!\n\n";
        message += "Factura:\n";
        message += "Número de factura: " + invoice.id + "\n";
        message += "Nombre: " + invoice.name + "\n";
        message += "Correo electrónico: " + invoice.email + "\n";
        message += "Teléfono: " + invoice.phone + "\n\n";
        message += "Productos:\n";
        invoice.items.forEach((item, index) => {
            message += `${index + 1}. ${item.name} - $${item.price}\n`;
        });
        message += "\nTotal: $" + invoice.total;
        return message;
    }

    function saveInvoiceToDB(invoice) {

        function generateRandomInvoiceId() {
            // Tire un random math porque me daba error con los numeros automaticos de la database.
            return Math.floor(Math.random() * 900000) + 100000;
        }
    

        invoice.id = generateRandomInvoiceId();

        const lowercaseInvoice = {
            name: invoice.name.toLowerCase(),
            email: invoice.email.toLowerCase(),
            phone: invoice.phone.toLowerCase(),
            items: invoice.items,
            total: invoice.total,
            timestamp: invoice.timestamp,
            id: invoice.id
        };
    
        const transaction = db.transaction(['invoices'], 'readwrite');
        const objectStore = transaction.objectStore('invoices');
        const request = objectStore.add(lowercaseInvoice);
    
        request.onsuccess = function(event) {
            console.log('Factura guardada en IndexedDB:', event.target.result);
        };
    
        request.onerror = function(event) {
            console.error('Error al guardar la factura:', event.target.error);
        };
    }


    function searchInvoice(query) {
        const transaction = db.transaction(['invoices'], 'readonly');
        const objectStore = transaction.objectStore('invoices');
        const indexName = objectStore.index('name');
        const indexEmail = objectStore.index('email');
        const indexPhone = objectStore.index('phone');

        const requestName = indexName.getAll(query);
        const requestEmail = indexEmail.getAll(query);
        const requestPhone = indexPhone.getAll(query);

        let invoices = [];

        requestName.onsuccess = function(event) {
            invoices = invoices.concat(event.target.result);
        };

        requestEmail.onsuccess = function(event) {
            invoices = invoices.concat(event.target.result);
        };

        requestPhone.onsuccess = function(event) {
            invoices = invoices.concat(event.target.result);
        };

        transaction.oncomplete = function() {
            if (invoices.length > 0) {
                showInvoice(invoices);
            } else {
                swal("Factura no encontrada", "No se encontraron facturas para el criterio de búsqueda proporcionado", "warning");
            }
        };
    }

    function showInvoice(invoices) {
        let message = "Facturas encontradas:\n\n";
        invoices.forEach((invoice, index) => {
            message += `Factura ${index + 1}:\n`;
            message += `Número de factura: ${invoice.id}\n`;
            message += `Nombre: ${invoice.name}\n`;
            message += `Correo electrónico: ${invoice.email}\n`;
            message += `Teléfono: ${invoice.phone}\n`;
            message += `Total: $${invoice.total}\n`;
            message += `Fecha: ${invoice.timestamp}\n\n`;
        });

        swal("Facturas encontradas", message, "success");
    }

    fetchProducts();
});
