-- Website CMS: "Web Page" collection (handle + dynamic-zone blocks), "Login" single type,
-- and the web.* components they're built from. Generated together with
-- content-schemas/{api/web-page,api/login,components/web} so columns match the schemas exactly.
--
-- Layout mirrors what Strapi would have created (see pages / pages_cmps /
-- components_blocks_hero_grids[_cmps]): content-type tables carry document_id / timestamps /
-- created_by / locale; component tables are id + scalar columns; anything owning
-- components gets a <table>_cmps link table; media links live in the existing files_related_mph.
--
-- Idempotent (IF NOT EXISTS) — safe to re-run. Brand-new tables only; nothing existing is altered.
-- After running: `yarn prisma:pull`.

-- ─── Web Page (collectionType) ───
CREATE TABLE IF NOT EXISTS web_pages (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(255),
  title VARCHAR(255),
  handle VARCHAR(255),
  seo_title VARCHAR(255),
  seo_description TEXT,
  created_at TIMESTAMP(6),
  updated_at TIMESTAMP(6),
  published_at TIMESTAMP(6),
  created_by_id INTEGER,
  updated_by_id INTEGER,
  locale VARCHAR(255),
  CONSTRAINT web_pages_created_by_id_fk FOREIGN KEY (created_by_id) REFERENCES admin_users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT web_pages_updated_by_id_fk FOREIGN KEY (updated_by_id) REFERENCES admin_users(id) ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS web_pages_documents_idx ON web_pages(document_id, locale, published_at);
CREATE TABLE IF NOT EXISTS web_pages_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT web_pages_entity_fk FOREIGN KEY (entity_id) REFERENCES web_pages(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT web_pages_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS web_pages_component_type_idx ON web_pages_cmps(component_type);
CREATE INDEX IF NOT EXISTS web_pages_field_idx ON web_pages_cmps(field);
CREATE INDEX IF NOT EXISTS web_pages_entity_fk ON web_pages_cmps(entity_id);

-- ─── Login (singleType) ───
CREATE TABLE IF NOT EXISTS logins (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(255),
  phone_title VARCHAR(255),
  phone_label VARCHAR(255),
  phone_placeholder VARCHAR(255),
  terms_prefix VARCHAR(255),
  terms_label VARCHAR(255),
  terms_url VARCHAR(255),
  privacy_label VARCHAR(255),
  privacy_url VARCHAR(255),
  continue_label VARCHAR(255),
  otp_title VARCHAR(255),
  otp_label VARCHAR(255),
  otp_subtitle VARCHAR(255),
  resend_countdown_text VARCHAR(255),
  resend_label VARCHAR(255),
  back_label VARCHAR(255),
  verify_label VARCHAR(255),
  welcome_title VARCHAR(255),
  signed_in_title VARCHAR(255),
  new_user_message TEXT,
  returning_user_message TEXT,
  done_label VARCHAR(255),
  created_at TIMESTAMP(6),
  updated_at TIMESTAMP(6),
  published_at TIMESTAMP(6),
  created_by_id INTEGER,
  updated_by_id INTEGER,
  locale VARCHAR(255),
  CONSTRAINT logins_created_by_id_fk FOREIGN KEY (created_by_id) REFERENCES admin_users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT logins_updated_by_id_fk FOREIGN KEY (updated_by_id) REFERENCES admin_users(id) ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS logins_documents_idx ON logins(document_id, locale, published_at);
CREATE TABLE IF NOT EXISTS logins_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT logins_entity_fk FOREIGN KEY (entity_id) REFERENCES logins(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT logins_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS logins_component_type_idx ON logins_cmps(component_type);
CREATE INDEX IF NOT EXISTS logins_field_idx ON logins_cmps(field);
CREATE INDEX IF NOT EXISTS logins_entity_fk ON logins_cmps(entity_id);

-- ─── web.* components ───
-- web.section-style
CREATE TABLE IF NOT EXISTS components_web_section_styles (
  id SERIAL PRIMARY KEY,
  background_color VARCHAR(255),
  gradient_from VARCHAR(255),
  gradient_to VARCHAR(255),
  gradient_angle INTEGER,
  padding_top INTEGER,
  padding_bottom INTEGER,
  padding_top_mobile INTEGER,
  padding_bottom_mobile INTEGER,
  max_width INTEGER,
  text_align VARCHAR(255),
  hidden BOOLEAN,
  anchor_id VARCHAR(255)
);

-- web.text-style
CREATE TABLE IF NOT EXISTS components_web_text_styles (
  id SERIAL PRIMARY KEY,
  color VARCHAR(255),
  font_size DECIMAL(10,2),
  font_size_mobile DECIMAL(10,2),
  font_weight VARCHAR(255),
  line_height DECIMAL(10,2),
  letter_spacing DECIMAL(10,2),
  uppercase BOOLEAN
);

-- web.button
CREATE TABLE IF NOT EXISTS components_web_buttons (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255),
  action VARCHAR(255),
  href VARCHAR(255),
  open_in_new_tab BOOLEAN,
  variant VARCHAR(255),
  background_color VARCHAR(255),
  text_color VARCHAR(255),
  border_color VARCHAR(255),
  border_radius INTEGER,
  font_size DECIMAL(10,2)
);

-- web.link
CREATE TABLE IF NOT EXISTS components_web_links (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255),
  action VARCHAR(255),
  href VARCHAR(255),
  open_in_new_tab BOOLEAN
);

-- web.drawer-style
CREATE TABLE IF NOT EXISTS components_web_drawer_styles (
  id SERIAL PRIMARY KEY,
  panel_background VARCHAR(255),
  backdrop_color VARCHAR(255),
  title_color VARCHAR(255),
  title_size DECIMAL(10,2),
  text_color VARCHAR(255),
  muted_color VARCHAR(255),
  input_background VARCHAR(255),
  input_border_color VARCHAR(255),
  accent_color VARCHAR(255),
  button_gradient_from VARCHAR(255),
  button_gradient_to VARCHAR(255),
  button_text_color VARCHAR(255),
  border_radius INTEGER
);

-- web.service-card
CREATE TABLE IF NOT EXISTS components_web_service_cards (
  id SERIAL PRIMARY KEY,
  appliance VARCHAR(255),
  title VARCHAR(255),
  dropdown_label VARCHAR(255),
  description TEXT,
  image_width INTEGER,
  image_height INTEGER,
  cta_label VARCHAR(255),
  cta_action VARCHAR(255),
  cta_href VARCHAR(255)
);

-- web.feature-card
CREATE TABLE IF NOT EXISTS components_web_feature_cards (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  description TEXT,
  illustration VARCHAR(255),
  image_width INTEGER,
  image_height INTEGER
);

-- web.city
CREATE TABLE IF NOT EXISTS components_web_cities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255)
);

-- web.header
CREATE TABLE IF NOT EXISTS components_web_headers (
  id SERIAL PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS components_web_headers_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_headers_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_headers(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_headers_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_headers_component_type_idx ON components_web_headers_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_headers_field_idx ON components_web_headers_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_headers_entity_fk ON components_web_headers_cmps(entity_id);

-- web.hero
CREATE TABLE IF NOT EXISTS components_web_heroes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  subtitle TEXT,
  service_label VARCHAR(255),
  service_placeholder VARCHAR(255),
  address_label VARCHAR(255),
  address_placeholder VARCHAR(255),
  search_background VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS components_web_heroes_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_heroes_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_heroes(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_heroes_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_heroes_component_type_idx ON components_web_heroes_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_heroes_field_idx ON components_web_heroes_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_heroes_entity_fk ON components_web_heroes_cmps(entity_id);

-- web.services-grid
CREATE TABLE IF NOT EXISTS components_web_services_grids (
  id SERIAL PRIMARY KEY,
  heading VARCHAR(255),
  card_background VARCHAR(255),
  coming_soon_title VARCHAR(255),
  coming_soon_description TEXT
);
CREATE TABLE IF NOT EXISTS components_web_services_grids_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_services_grids_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_services_grids(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_services_grids_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_services_grids_component_type_idx ON components_web_services_grids_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_services_grids_field_idx ON components_web_services_grids_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_services_grids_entity_fk ON components_web_services_grids_cmps(entity_id);

-- web.feature-grid
CREATE TABLE IF NOT EXISTS components_web_feature_grids (
  id SERIAL PRIMARY KEY,
  heading VARCHAR(255),
  card_background VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS components_web_feature_grids_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_feature_grids_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_feature_grids(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_feature_grids_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_feature_grids_component_type_idx ON components_web_feature_grids_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_feature_grids_field_idx ON components_web_feature_grids_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_feature_grids_entity_fk ON components_web_feature_grids_cmps(entity_id);

-- web.app-promo
CREATE TABLE IF NOT EXISTS components_web_app_promos (
  id SERIAL PRIMARY KEY,
  lead TEXT,
  tagline_top VARCHAR(255),
  tagline_bottom VARCHAR(255),
  arc_color_from VARCHAR(255),
  arc_color_to VARCHAR(255),
  qr_label VARCHAR(255),
  qr_link VARCHAR(255),
  qr_card_background VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS components_web_app_promos_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_app_promos_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_app_promos(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_app_promos_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_app_promos_component_type_idx ON components_web_app_promos_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_app_promos_field_idx ON components_web_app_promos_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_app_promos_entity_fk ON components_web_app_promos_cmps(entity_id);

-- web.support
CREATE TABLE IF NOT EXISTS components_web_supports (
  id SERIAL PRIMARY KEY,
  eyebrow VARCHAR(255),
  phone_number VARCHAR(255),
  description TEXT
);
CREATE TABLE IF NOT EXISTS components_web_supports_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_supports_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_supports(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_supports_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_supports_component_type_idx ON components_web_supports_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_supports_field_idx ON components_web_supports_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_supports_entity_fk ON components_web_supports_cmps(entity_id);

-- web.counter
CREATE TABLE IF NOT EXISTS components_web_counters (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255),
  value VARCHAR(255),
  animate BOOLEAN,
  digit_color VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS components_web_counters_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_counters_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_counters(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_counters_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_counters_component_type_idx ON components_web_counters_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_counters_field_idx ON components_web_counters_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_counters_entity_fk ON components_web_counters_cmps(entity_id);

-- web.help-cta
CREATE TABLE IF NOT EXISTS components_web_help_ctas (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  cities_label VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS components_web_help_ctas_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_help_ctas_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_help_ctas(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_help_ctas_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_help_ctas_component_type_idx ON components_web_help_ctas_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_help_ctas_field_idx ON components_web_help_ctas_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_help_ctas_entity_fk ON components_web_help_ctas_cmps(entity_id);

-- web.footer
CREATE TABLE IF NOT EXISTS components_web_footers (
  id SERIAL PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS components_web_footers_cmps (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT components_web_footers_entity_fk FOREIGN KEY (entity_id) REFERENCES components_web_footers(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT components_web_footers_uq UNIQUE (entity_id, cmp_id, field, component_type)
);
CREATE INDEX IF NOT EXISTS components_web_footers_component_type_idx ON components_web_footers_cmps(component_type);
CREATE INDEX IF NOT EXISTS components_web_footers_field_idx ON components_web_footers_cmps(field);
CREATE INDEX IF NOT EXISTS components_web_footers_entity_fk ON components_web_footers_cmps(entity_id);
