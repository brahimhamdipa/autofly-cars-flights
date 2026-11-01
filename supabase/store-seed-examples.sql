-- AutoFly example seed — run AFTER store-redesign.sql, as its own query.
-- These examples STAY: they are the demo catalog for the redesigned shop,
-- not test rows to delete after testing.
-- Stores, variant definitions, items, categories links, delivery + pickup
-- locations and their item links. All lookups are by name/slug, so the
-- script works regardless of the ids the wipe restarted.

-- Stores
insert into store_providers (name, phone, email, address, city, country, zip, hours, about, pics, holdorder, payorder) values
('Demo Fresh Market', '+1 212-555-0100', 'demo@autofly.us.com', '250 Broadway', 'New York', 'USA', '10001', 'Mon–Sat 8am–8pm', 'Example store for trying out the new shop: drinks, dairy and more.', array['https://picsum.photos/seed/demo-market-1/800/600','https://picsum.photos/seed/demo-market-2/800/600'], true, true),
('Demo Corner Shop', '+212 522-555-0100', 'demo2@autofly.us.com', '45 Boulevard Anfa', 'Casablanca', 'Morocco', '20100', 'Daily 9am–9pm', 'Example corner shop: clothes, cheese and everyday goods.', array['https://picsum.photos/seed/demo-corner-1/800/600','https://picsum.photos/seed/demo-corner-2/800/600'], true, true);

-- Variant definitions (subCategory rows belong to a category, not an item):
-- drinks offer flavors + pack sizes, clothes offer colors + sizes.
insert into "subCategory" (category_id, flavor, color, packof, size, weight, unit) values
((select id from category where slug = 'drinks'), 'Original', '', 12, '', null, ''),
((select id from category where slug = 'drinks'), 'Mango', '', 12, '', null, ''),
((select id from category where slug = 'drinks'), 'Berry', '', 6, '', null, ''),
((select id from category where slug = 'clothes'), '', 'Red', null, 'M', null, ''),
((select id from category where slug = 'clothes'), '', 'Blue', null, 'L', null, '');

-- Items (all live immediately: is_active true, pending_approval false)
insert into store_items (provider_id, name, price, description, delivery_address, pickup_address, delivery, pickup, is_active, stock, pics, "barCode") values
((select id from store_providers where name = 'Demo Fresh Market'), 'Monster Energy Drink', 2.50, 'Example energy drink — pick a flavor and pack size before adding to cart.', 'Downtown Depot, New York', '250 Broadway, New York', true, true, true, 100, array['https://picsum.photos/seed/monster-1/800/600'], 'DEMO-MONSTER-001'),
((select id from store_providers where name = 'Demo Fresh Market'), 'Orange Juice 1L', 3.99, 'Example chilled orange juice, 1 litre.', 'Downtown Depot, New York', '250 Broadway, New York', true, true, true, 50, array['https://picsum.photos/seed/oj-1/800/600'], ''),
((select id from store_providers where name = 'Demo Corner Shop'), 'Cotton T-Shirt', 15.00, 'Example cotton T-shirt — pick a color and size before adding to cart.', 'Anfa Depot, Casablanca', '45 Boulevard Anfa, Casablanca', true, true, true, 40, array['https://picsum.photos/seed/tee-1/800/600'], ''),
((select id from store_providers where name = 'Demo Corner Shop'), 'Cheddar Cheese 500g', 8.50, 'Example aged cheddar, 500 g.', 'Anfa Depot, Casablanca', '45 Boulevard Anfa, Casablanca', true, true, true, 30, array['https://picsum.photos/seed/cheddar-1/800/600'], '');

-- Item <-> category links (the ONLY item/category link now)
insert into store_item_categories (item_id, category_id) values
((select id from store_items where name = 'Monster Energy Drink'), (select id from category where slug = 'drinks')),
((select id from store_items where name = 'Orange Juice 1L'), (select id from category where slug = 'drinks')),
((select id from store_items where name = 'Cotton T-Shirt'), (select id from category where slug = 'clothes')),
((select id from store_items where name = 'Cheddar Cheese 500g'), (select id from category where slug = 'dairy'));

-- Delivery + pickup locations (their city/zip ARE the delivery coverage)
insert into "fromDel" (fname, faddress, fcity, fstate, fzip, fcountry) values
('Downtown Depot', '250 Broadway', 'New York', 'NY', '10001', 'USA'),
('Anfa Depot', '45 Boulevard Anfa', 'Casablanca', '', '20100', 'Morocco');
insert into "toPick" (tname, taddress, tcity, tstate, tzip, tcountry) values
('Main Store Pickup', '250 Broadway', 'New York', 'NY', '10001', 'USA'),
('Corner Pickup', '45 Boulevard Anfa', 'Casablanca', '', '20100', 'Morocco');

-- Item <-> location links (per store, so popups + coverage work)
insert into store_item_fromdel (item_id, fromdel_id) values
((select id from store_items where name = 'Monster Energy Drink'), (select id from "fromDel" where fname = 'Downtown Depot')),
((select id from store_items where name = 'Orange Juice 1L'), (select id from "fromDel" where fname = 'Downtown Depot')),
((select id from store_items where name = 'Cotton T-Shirt'), (select id from "fromDel" where fname = 'Anfa Depot')),
((select id from store_items where name = 'Cheddar Cheese 500g'), (select id from "fromDel" where fname = 'Anfa Depot'));
insert into store_item_topick (item_id, topick_id) values
((select id from store_items where name = 'Monster Energy Drink'), (select id from "toPick" where tname = 'Main Store Pickup')),
((select id from store_items where name = 'Orange Juice 1L'), (select id from "toPick" where tname = 'Main Store Pickup')),
((select id from store_items where name = 'Cotton T-Shirt'), (select id from "toPick" where tname = 'Corner Pickup')),
((select id from store_items where name = 'Cheddar Cheese 500g'), (select id from "toPick" where tname = 'Corner Pickup'));
