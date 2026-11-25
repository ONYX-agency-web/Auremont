(() => {
  const FREE_FROM = 15000;
  const DELIVERY = 490;
  const MAX_QTY = 9;
  const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  const STORE = 'auremont-cart';
  /* Адрес сервера, который принимает заказы (POST, JSON). Пока пусто: заказ никуда не уходит, а страница только показывает подтверждение. */
  const ORDER_URL = '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
  const plural = (n, forms) => {
    const a = n % 10;
    const b = n % 100;
    if (a === 1 && b !== 11) return forms[0];
    return a >= 2 && a <= 4 && (b < 10 || b >= 20) ? forms[1] : forms[2];
  };

  /* Появление блоков при прокрутке. Скрытое состояние задаёт CSS, поэтому без JS всё видно. */
  const revealItems = $$('[data-reveal]');
  const show = (el) => {
    el.classList.add('is-visible');
    if (el.matches('.product')) $$('.product').forEach((card) => card.classList.add('is-visible'));
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      show(entry.target);
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealItems.forEach((el) => observer.observe(el));
  } else {
    revealItems.forEach(show);
  }

  /* Меню */
  const menu = $('.menu-toggle');
  const nav = $('.nav');
  const setMenu = (open) => {
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    nav.classList.toggle('is-open', open);
  };
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenu(false); });
  matchMedia('(min-width: 900px)').addEventListener('change', (event) => { if (event.matches) setMenu(false); });

  /* Избранное */
  $$('.wish').forEach((button) => button.addEventListener('click', () => {
    const saved = button.classList.toggle('saved');
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', saved ? 'Убрать из избранного' : 'Добавить в избранное');
  }));

  /* Каталог берём из разметки, чтобы цены и названия лежали в одном месте */
  const catalog = {};
  $$('.product').forEach((card) => {
    catalog[card.dataset.id] = {
      name: card.dataset.name,
      price: Number(card.dataset.price),
      img: card.dataset.thumb,
    };
  });

  /* Состояние корзины */
  let cart = [];
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (Array.isArray(saved)) {
      cart = saved.filter((i) => catalog[i.id] && SIZES.includes(i.size) && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= MAX_QTY);
    }
  } catch (error) { cart = []; }
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(cart)); } catch (error) { /* хранилище недоступно */ } };

  const totals = () => {
    const subtotal = cart.reduce((sum, i) => sum + catalog[i.id].price * i.qty, 0);
    const count = cart.reduce((sum, i) => sum + i.qty, 0);
    const delivery = subtotal === 0 || subtotal >= FREE_FROM ? 0 : DELIVERY;
    return { subtotal, count, delivery, total: subtotal + delivery };
  };
  const find = (id, size) => cart.find((i) => i.id === id && i.size === size);

  const addItem = (id, size) => {
    const line = find(id, size);
    if (line) line.qty = Math.min(MAX_QTY, line.qty + 1);
    else cart.push({ id, size, qty: 1 });
    update();
  };
  const changeQty = (id, size, qty) => {
    const line = find(id, size);
    if (!line) return;
    if (qty < 1) cart = cart.filter((i) => i !== line);
    else line.qty = Math.min(MAX_QTY, qty);
    update();
  };

  /* Корзина */
  const dialog = $('#cart');
  const views = { cart: $('#view-cart'), checkout: $('#view-checkout'), done: $('#view-done') };
  const list = $('.cart-list');
  const template = $('#cart-line');
  const fab = $('.cart-fab');
  const bag = $('.bag');

  const setView = (name) => Object.entries(views).forEach(([key, node]) => { node.hidden = key !== name; });
  const CLOSE_MS = 300;
  const openCart = () => { if (!dialog.open) dialog.showModal(); };
  const closeCart = () => {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { dialog.close(); return; }
    dialog.classList.add('is-closing');
    setTimeout(() => { dialog.classList.remove('is-closing'); if (dialog.open) dialog.close(); }, CLOSE_MS);
  };

  const update = () => {
    const { subtotal, count, delivery, total } = totals();
    persist();

    $$('[data-cart-count]').forEach((node) => { node.textContent = count; });
    bag.setAttribute('aria-label', count ? `Корзина, ${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : 'Корзина, пусто');
    $('[data-fab-label]', fab).textContent = `Корзина, ${count}`;
    $('[data-fab-total]', fab).textContent = money(subtotal);
    fab.hidden = count === 0 || dialog.open;
    document.body.classList.toggle('has-fab', count > 0);

    $('.cart-empty').hidden = count > 0;
    $('.cart-filled').hidden = count === 0;
    $('[data-checkout]').disabled = count === 0;

    $('.progress-text').textContent = subtotal >= FREE_FROM
      ? 'Доставка бесплатная.'
      : `До бесплатной доставки ${money(FREE_FROM - subtotal)}.`;
    $('.progress span').style.width = `${Math.min(100, (subtotal / FREE_FROM) * 100)}%`;

    $$('[data-sum="subtotal"]').forEach((n) => { n.textContent = money(subtotal); });
    $$('[data-sum="delivery"]').forEach((n) => { n.textContent = delivery ? money(delivery) : 'Бесплатно'; });
    $$('[data-sum="total"]').forEach((n) => { n.textContent = money(total); });

    list.replaceChildren(...cart.map((item) => {
      const product = catalog[item.id];
      const row = template.content.firstElementChild.cloneNode(true);
      row.dataset.id = item.id;
      row.dataset.size = item.size;
      const img = $('img', row);
      img.src = product.img;
      $('h3', row).textContent = product.name;
      $('.cart-item-size', row).textContent = `Размер ${item.size}, ${money(product.price)}`;
      $('output', row).textContent = item.qty;
      $('strong', row).textContent = money(product.price * item.qty);
      $('[data-act="inc"]', row).disabled = item.qty >= MAX_QTY;
      return row;
    }));
  };

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const row = button.closest('.cart-item');
    const line = find(row.dataset.id, row.dataset.size);
    if (!line) return;
    const { id, size } = line;
    const act = button.dataset.act;
    if (act === 'inc') changeQty(id, size, line.qty + 1);
    if (act === 'dec') changeQty(id, size, line.qty - 1);
    if (act === 'remove') changeQty(id, size, 0);

    const own = `.cart-item[data-id="${id}"][data-size="${size}"]`;
    const next = $(`${own} [data-act="${act}"]:not(:disabled)`, list)
      || $(`${own} [data-act="dec"]`, list)
      || $('.cart-item [data-act]', list)
      || $('.cart-empty a');
    if (next) next.focus();
  });

  bag.addEventListener('click', openCart);
  fab.addEventListener('click', openCart);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest('[data-close]')) closeCart();
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeCart(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('no-scroll');
    setView('cart');
    update();
  });
  new MutationObserver(() => document.body.classList.toggle('no-scroll', dialog.open))
    .observe(dialog, { attributes: true, attributeFilter: ['open'] });

  /* Выбор размера и добавление из карточки */
  $$('.product').forEach((card) => {
    const button = $('.add', card);
    const sizes = $$('input[type="radio"]', card);
    sizes.forEach((input) => input.addEventListener('change', () => {
      button.disabled = false;
      button.textContent = `В корзину, ${input.value}`;
    }));
    button.addEventListener('click', () => {
      const chosen = sizes.find((input) => input.checked);
      if (!chosen) return;
      addItem(card.dataset.id, chosen.value);
      setView('cart');
      openCart();
    });
  });

  /* Оформление. Заказ никуда не уходит: к форме нужно подключить сервер или платёжную систему. */
  $('[data-checkout]').addEventListener('click', () => {
    setView('checkout');
    $('input', views.checkout).focus();
  });
  $('[data-back]').addEventListener('click', () => setView('cart'));

  const form = $('#view-checkout');
  const submitButton = $('[type="submit"]', form);
  const formError = $('.form-error', form);

  const rules = {
    name: (v) => (/^[\p{L}][\p{L}\s'’.-]+$/u.test(v.trim()) ? '' : 'Введите имя буквами'),
    phone: (v) => {
      const digits = v.replace(/\D/g, '');
      const valid = /^[+\d\s()-]+$/.test(v.trim())
        && (digits.length === 10 || (digits.length === 11 && /^[78]/.test(digits)));
      return valid ? '' : 'Введите телефон полностью, например +7 900 123 45 67';
    },
    address: (v) => (v.trim().length >= 8 && /\p{L}/u.test(v) && /\d/.test(v) ? '' : 'Укажите город, улицу и номер дома'),
  };
  const validate = (input) => {
    const message = rules[input.name](input.value);
    input.setAttribute('aria-invalid', String(Boolean(message)));
    $('small', input.parentElement).textContent = message;
    return !message;
  };

  const sendOrder = async (customer) => {
    const { subtotal, delivery, total } = totals();
    const payload = {
      customer,
      items: cart.map((i) => ({ id: i.id, name: catalog[i.id].name, size: i.size, qty: i.qty, price: catalog[i.id].price })),
      subtotal, delivery, total,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(ORDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json().catch(() => ({}));
      return data.number;
    } finally {
      clearTimeout(timer);
    }
  };

  $$('input', form).forEach((input) => input.addEventListener('blur', () => { if (input.value) validate(input); }));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitButton.disabled || cart.length === 0) return;
    const inputs = $$('input', form);
    const results = inputs.map(validate);
    if (!results.every(Boolean)) { inputs[results.indexOf(false)].focus(); return; }

    const customer = Object.fromEntries(inputs.map((input) => [input.name, input.value.trim()]));
    formError.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Отправляем заказ';
    try {
      const number = (ORDER_URL ? await sendOrder(customer) : null) || Math.floor(1000 + Math.random() * 9000);
      $('.done-text').textContent = `Номер заказа ${number}. Мы позвоним по номеру ${customer.phone}, чтобы подтвердить доставку.`;
      cart = [];
      form.reset();
      setView('done');
      update();
      $('.done h3').focus();
    } catch {
      formError.textContent = 'Не получилось отправить заказ. Проверьте интернет и попробуйте ещё раз.';
      formError.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Подтвердить заказ';
    }
  });

  update();
})();
