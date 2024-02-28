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
                swal.fire("¡Producto agregado al carrito!", "", "success");
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
            swal.fire("Carrito vacío", "Agrega productos al carrito antes de pagar", "warning");
            return;
        }
    
        const customerName = document.getElementById('customer-name').value;
        const customerEmail = document.getElementById('customer-email').value;
        const customerPhone = document.getElementById('customer-phone').value;
    
        if (!customerName || !customerEmail || !customerPhone) {
            swal.fire("Datos del cliente incompletos", "Por favor, ingrese todos los datos del cliente", "warning");
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
    
        swal.fire({
            title: 'Confirmar compra',
            text: '¿Estás seguro de que quieres proceder con el pago?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, pagar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                // Proceder con el pago y guardar la factura
                saveInvoiceToDB(invoice);
                localStorage.removeItem('cartItems');
                updateCartView();
                const invoiceMessage = generateInvoiceMessage(invoice);
                swal.fire("¡Compra realizada!", invoiceMessage, "success");
            }
        });
    });
    

    

    searchButton.addEventListener('click', () => {
        const query = searchInput.value;
        if (query.trim() !== '') {
            searchInvoice(query);
        } else {
            swal.fire("Campo de búsqueda vacío", "Por favor, ingrese un nombre, correo electrónico o teléfono para buscar la factura", "warning");
        }
    });

    function generateInvoiceMessage(invoice) {
        let messageLines = [];
        messageLines.push("<b>¡Compra realizada!</b>");
        messageLines.push("<b>Factura:</b>");
        messageLines.push("<b>Número de factura:</b> " + invoice.id);
        messageLines.push("<b>Nombre:</b> " + invoice.name);
        messageLines.push("<b>Correo electrónico:</b> " + invoice.email);
        messageLines.push("<b>Teléfono:</b> " + invoice.phone);
        messageLines.push("<b>Productos:</b>");
        invoice.items.forEach((item, index) => {
            messageLines.push(`<b>${index + 1}.</b> ${item.name} - <b>$${item.price}</b>`);
        });
        messageLines.push("<b>Total:</b> $" + invoice.total);
        return messageLines.join("<br>");
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
    
        // No es necesario utilizar toLowerCase() en los índices del objectStore
    
        const indexName = objectStore.index('name');
        const indexEmail = objectStore.index('email');
        const indexPhone = objectStore.index('phone');
    
        const requestName = indexName.getAll(query.toLowerCase()); // Convertir query a minúsculas
        const requestEmail = indexEmail.getAll(query.toLowerCase()); // Convertir query a minúsculas
        const requestPhone = indexPhone.getAll(query.toLowerCase()); // Convertir query a minúsculas
    
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
                const message = showInvoice(invoices); 
                swal.fire("Facturas encontradas", message, "success");
            } else {
                swal.fire("Factura no encontrada", "No se encontraron facturas para el criterio de búsqueda proporcionado", "warning");
            }
        };
    }

    function showInvoice(invoices) {
        let messageLines = [];
        messageLines.push("<b>Facturas encontradas:</b><br><br>");
        invoices.forEach((invoice, index) => {
            messageLines.push(`<b>Factura ${index + 1}:</b>`);
            messageLines.push(`<b>Número de factura:</b> ${invoice.id}`);
            messageLines.push(`<b>Nombre:</b> ${invoice.name}`);
            messageLines.push(`<b>Correo electrónico:</b> ${invoice.email}`);
            messageLines.push(`<b>Teléfono:</b> ${invoice.phone}`);
            messageLines.push(`<b>Total:</b> $${invoice.total}`);
            messageLines.push(`<b>Fecha:</b> ${invoice.timestamp}<br>`);
        });
        return messageLines.join("<br>");
    }

    fetchProducts();
});
