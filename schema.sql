--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3
-- Dumped by pg_dump version 16.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: articulos; Type: TABLE; Schema: public; Owner: danascan
--

CREATE TABLE public.articulos (
    id integer NOT NULL,
    lectura bigint,
    articulo character varying(255)
);


ALTER TABLE public.articulos OWNER TO danascan;

--
-- Name: articulos_id_seq; Type: SEQUENCE; Schema: public; Owner: danascan
--

CREATE SEQUENCE public.articulos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.articulos_id_seq OWNER TO danascan;

--
-- Name: articulos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: danascan
--

ALTER SEQUENCE public.articulos_id_seq OWNED BY public.articulos.id;


--
-- Name: centro; Type: TABLE; Schema: public; Owner: danascan
--

CREATE TABLE public.centro (
    id integer NOT NULL,
    centro character varying(255) NOT NULL,
    ismain boolean DEFAULT false
);


ALTER TABLE public.centro OWNER TO danascan;

--
-- Name: centro_id_seq; Type: SEQUENCE; Schema: public; Owner: danascan
--

CREATE SEQUENCE public.centro_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.centro_id_seq OWNER TO danascan;

--
-- Name: centro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: danascan
--

ALTER SEQUENCE public.centro_id_seq OWNED BY public.centro.id;


--
-- Name: codigo; Type: TABLE; Schema: public; Owner: danascan
--

CREATE TABLE public.codigo (
    codigo integer,
    "expiración" character varying(255)
);


ALTER TABLE public.codigo OWNER TO danascan;

--
-- Name: codigoadmin; Type: TABLE; Schema: public; Owner: danascan
--

CREATE TABLE public.codigoadmin (
    codigo character varying(255),
    "expiración" character varying(255)
);


ALTER TABLE public.codigoadmin OWNER TO danascan;

--
-- Name: reparto; Type: TABLE; Schema: public; Owner: danascan
--

CREATE TABLE public.reparto (
    id integer NOT NULL,
    lectura bigint,
    "timestamp" character varying(255),
    almacen integer,
    fulfilled integer DEFAULT 0,
    timestamp_recepcion character varying(255) DEFAULT 0,
    issimulated boolean DEFAULT false
);


ALTER TABLE public.reparto OWNER TO danascan;

--
-- Name: reparto_id_seq; Type: SEQUENCE; Schema: public; Owner: danascan
--

CREATE SEQUENCE public.reparto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reparto_id_seq OWNER TO danascan;

--
-- Name: reparto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: danascan
--

ALTER SEQUENCE public.reparto_id_seq OWNED BY public.reparto.id;


--
-- Name: articulos id; Type: DEFAULT; Schema: public; Owner: danascan
--

ALTER TABLE ONLY public.articulos ALTER COLUMN id SET DEFAULT nextval('public.articulos_id_seq'::regclass);


--
-- Name: centro id; Type: DEFAULT; Schema: public; Owner: danascan
--

ALTER TABLE ONLY public.centro ALTER COLUMN id SET DEFAULT nextval('public.centro_id_seq'::regclass);


--
-- Name: reparto id; Type: DEFAULT; Schema: public; Owner: danascan
--

ALTER TABLE ONLY public.reparto ALTER COLUMN id SET DEFAULT nextval('public.reparto_id_seq'::regclass);


--
-- Name: articulos articulos_pkey; Type: CONSTRAINT; Schema: public; Owner: danascan
--

ALTER TABLE ONLY public.articulos
    ADD CONSTRAINT articulos_pkey PRIMARY KEY (id);


--
-- Name: centro centro_pkey; Type: CONSTRAINT; Schema: public; Owner: danascan
--

ALTER TABLE ONLY public.centro
    ADD CONSTRAINT centro_pkey PRIMARY KEY (id);


--
-- Name: reparto reparto_pkey; Type: CONSTRAINT; Schema: public; Owner: danascan
--

ALTER TABLE ONLY public.reparto
    ADD CONSTRAINT reparto_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

