// Catálogo MSJ: fuente única para la vista de demostración y para el botón «Cargar catálogo MSJ» del panel.
// i = id de foto de Unsplash (licencia libre). Si i está vacío, la tienda muestra el ícono de la categoría.
// Claves: s slug · n nombre · c categoría · a audiencia · p precio · d descuento % · nw novedad · b marca · i imagen · m foto en modelo · co colores · z tallas · cl colecciones · de descripción
window.MSJ_DATA = (() => {
  const departments = [
    {slug:'ropa',name:'Ropa',icon:'👕'},
    {slug:'calzado',name:'Calzado',icon:'👟'},
    {slug:'accesorios',name:'Accesorios',icon:'👜'},
    {slug:'perfumes',name:'Perfumes',icon:'✨'}
  ];
  const categories = [
    {slug:'polos',name:'Polos',department:'ropa',icon:'👕',image:'1521572163474-6864f9cf17ab'},
    {slug:'camisas',name:'Camisas',department:'ropa',icon:'👔',image:'1596755094514-f87e34085b2c'},
    {slug:'blusas',name:'Blusas y tops',department:'ropa',icon:'👚',image:'1564257631407-4deb1f99d992'},
    {slug:'poleras',name:'Poleras y capuchas',department:'ropa',icon:'🧥',image:'1556821840-3a63f95609a7'},
    {slug:'casacas',name:'Casacas',department:'ropa',icon:'🧥',image:'1591047139829-d91aecb6caea'},
    {slug:'abrigos',name:'Abrigos',department:'ropa',icon:'🧥',image:'1539533018447-63fcce2678e3'},
    {slug:'chompas',name:'Chompas',department:'ropa',icon:'🧶',image:'1434389677669-e08b4cac3105'},
    {slug:'blazers',name:'Blazers y ternos',department:'ropa',icon:'🤵',image:'1617137968427-85924c800a22'},
    {slug:'jeans',name:'Jeans',department:'ropa',icon:'👖',image:'1541099649105-f69ad21f3246'},
    {slug:'pantalones',name:'Pantalones',department:'ropa',icon:'👖',image:'1473966968600-fa801b869a1a'},
    {slug:'joggers',name:'Joggers',department:'ropa',icon:'👖',image:'1506629082955-511b1aa562c8'},
    {slug:'shorts',name:'Shorts',department:'ropa',icon:'🩳',image:'1591195853828-11db59a44f6b'},
    {slug:'vestidos',name:'Vestidos',department:'ropa',icon:'👗',image:'1496747611176-843222e1e57c'},
    {slug:'faldas',name:'Faldas',department:'ropa',icon:'👗',image:'1577900232427-18219b9166a0'},
    {slug:'conjuntos',name:'Conjuntos y deportivo',department:'ropa',icon:'🎽',image:'1515886657613-9f3515b0c78f'},
    {slug:'zapatillas',name:'Zapatillas',department:'calzado',icon:'👟',image:'1491553895911-0055eca6402d'},
    {slug:'zapatos',name:'Zapatos',department:'calzado',icon:'👞',image:'1449505278894-297fdb3edbc1'},
    {slug:'botas',name:'Botas y botines',department:'calzado',icon:'🥾',image:'1605812860427-4024433a70fd'},
    {slug:'sandalias',name:'Sandalias',department:'calzado',icon:'👡',image:'1603487742131-4160ec999306'},
    {slug:'tacones',name:'Tacones',department:'calzado',icon:'👠',image:'1543163521-1bf539c55dd2'},
    {slug:'gorras',name:'Gorras y gorros',department:'accesorios',icon:'🧢',image:'1588850561407-ed78c282e89b'},
    {slug:'bolsos',name:'Bolsos y carteras',department:'accesorios',icon:'👜',image:'1584917865442-de89df76afd3'},
    {slug:'mochilas',name:'Mochilas',department:'accesorios',icon:'🎒',image:'1553062407-98eeb64c6a62'},
    {slug:'lentes',name:'Lentes de sol',department:'accesorios',icon:'🕶️',image:'1511499767150-a48a237f0083'},
    {slug:'relojes',name:'Relojes',department:'accesorios',icon:'⌚',image:'1524592094714-0f0654e20314'},
    {slug:'joyeria',name:'Joyería',department:'accesorios',icon:'💍',image:'1611652022419-a9419f74343d'},
    {slug:'cinturones',name:'Cinturones y billeteras',department:'accesorios',icon:'👛',image:'1624222247344-550fb60583dc'},
    {slug:'perfumes',name:'Perfumes',department:'perfumes',icon:'✨',image:'1615634260167-c8cdede054de'}
  ];
  const brands = [
    {slug:'msj-essentials',name:'MSJ Essentials'},
    {slug:'msj-urban',name:'MSJ Urban'},
    {slug:'msj-active',name:'MSJ Active'},
    {slug:'atelier-msj',name:'Atelier MSJ'},
    {slug:'andes-leather',name:'Andes Leather'},
    {slug:'lumen',name:'Lumen'},
    {slug:'maison-msj',name:'Maison MSJ'}
  ];
  const collections = [
    {slug:'otono-invierno',name:'Otoño-Invierno',description:'Abrigos de lana, chompas y botines para la temporada fría.',image:'1617019114583-affb34d1b3cd'},
    {slug:'minimal-luxury',name:'Minimal Luxury',description:'Líneas limpias, tonos neutros y materiales nobles.',image:'1571513722275-4b41940f54b8'},
    {slug:'night-edition',name:'Night Edition',description:'Vestidos, sastrería y fragancias para brillar de noche.',image:'1566174053879-31528523f8ae'},
    {slug:'urbano',name:'Estilo urbano',description:'Capuchas, casacas y zapatillas para moverte por la ciudad.',image:'1509942774463-acf339cf87d5'},
    {slug:'oficina',name:'Oficina y formal',description:'Camisas, blazers y zapatos para tus días de trabajo.',image:'1507679799987-c73779587ccf'},
    {slug:'frio',name:'Temporada de frío',description:'Abrigos, chompas y botas para los meses fríos.',image:'1485968579580-b6d095142e6e'},
    {slug:'deportivo',name:'Deportivo',description:'Conjuntos, joggers y zapatillas para entrenar.',image:'1515886657613-9f3515b0c78f'},
    {slug:'noche',name:'Noche y eventos',description:'Vestidos, tacones y fragancias para ocasiones especiales.',image:'1595777457583-95e059d581b8'},
    {slug:'verano',name:'Verano',description:'Prendas frescas, shorts, sandalias y lentes de sol.',image:'1473496169904-658ba7c44d8a'},
    {slug:'basicos',name:'Básicos esenciales',description:'Las piezas que combinan con todo.',image:'1562157873-818bc0726f68'}
  ];
  const W = ['XS','S','M','L','XL'], M = ['S','M','L','XL','XXL'], U = ['S','M','L','XL'];
  const JM = ['28','30','32','34','36'], JW = ['24','26','28','30','32'];
  const SW = ['35','36','37','38','39','40'], SM = ['39','40','41','42','43','44'], SU = ['36','37','38','39','40','41','42','43','44'];
  const ONE = ['Única'], ML = ['50 ml','100 ml'];
  const products = [
    // Polos
    {s:'polo-clasico-premium',n:'Polo Clásico Premium',c:'polos',a:'Hombre',p:89,b:'msj-essentials',i:'1586790170083-2f9ceadc732d',co:['Blanco','Negro','Azul marino'],z:M,cl:['basicos'],de:'Algodón peinado de tacto suave con cuello reforzado y corte regular.'},
    {s:'camiseta-base',n:'Polo Base Algodón',c:'polos',a:'Hombre',p:39,b:'msj-essentials',i:'1521572163474-6864f9cf17ab',co:['Blanco','Negro','Gris'],z:M,cl:['basicos'],de:'El básico de todos los días: algodón 100% y cuello redondo.'},
    {s:'polo-oversize-skull',n:'Polo Oversize Hand',c:'polos',a:'Hombre',p:59,nw:1,b:'msj-urban',i:'1503341504253-dff4815485f1',co:['Negro'],z:M,cl:['urbano'],de:'Corte oversize con estampado frontal y hombros caídos.'},
    {s:'polo-grafico-explorer',n:'Polo Gráfico Explorer',c:'polos',a:'Hombre',p:55,b:'msj-urban',i:'1571945153237-4929e783af4a',co:['Blanco'],z:M,cl:['urbano','verano'],de:'Polo blanco con estampado frontal de inspiración outdoor.'},
    {s:'polo-negro-minimal',n:'Polo Negro Minimal',c:'polos',a:'Hombre',p:49,b:'msj-essentials',i:'1583743814966-8936f5b7be1a',co:['Negro'],z:M,cl:['basicos'],de:'Estampado tipográfico discreto sobre algodón grueso.'},
    {s:'polo-logo-circular',n:'Polo Logo Circular',c:'polos',a:'Unisex',p:52,d:15,b:'msj-urban',i:'1618354691373-d851c5c3a990',co:['Negro','Blanco'],z:U,cl:['urbano'],de:'Polo unisex con logo bordado en el pecho.'},
    {s:'polo-original-print',n:'Polo Original Print',c:'polos',a:'Unisex',p:59,nw:1,b:'msj-urban',i:'1576566588028-4147f3842f27',co:['Crudo'],z:U,cl:['urbano'],de:'Estampado gráfico de estilo japonés sobre algodón crudo.'},
    {s:'polo-blanco-esencial',n:'Polo Blanco Esencial',c:'polos',a:'Unisex',p:35,b:'msj-essentials',i:'1581655353564-df123a1eb820',co:['Blanco'],z:U,cl:['basicos'],de:'Un polo blanco limpio, ligero y fácil de combinar.'},
    {s:'pack-polos-colores',n:'Pack x3 Polos Color',c:'polos',a:'Unisex',p:99,d:10,b:'msj-essentials',i:'1562157873-818bc0726f68',co:['Surtido'],z:U,cl:['basicos'],de:'Tres polos de algodón en colores combinables.'},
    {s:'polo-mujer-paz',n:'Polo Mujer Paz',c:'polos',a:'Mujer',p:45,b:'msj-urban',i:'1503342217505-b0a15ec3261c',co:['Negro'],z:W,cl:['urbano'],de:'Polo negro con estampado frontal y corte relajado.'},
    {s:'polo-mujer-crop-grafico',n:'Polo Crop Gráfico',c:'polos',a:'Mujer',p:49,nw:1,b:'msj-urban',i:'1503342394128-c104d54dba01',co:['Negro','Blanco'],z:W,cl:['urbano','verano'],de:'Silueta corta con estampado frontal, ideal con jeans de tiro alto.'},
    {s:'polo-mujer-ciudad',n:'Polo Mujer Ciudad',c:'polos',a:'Mujer',p:45,b:'msj-urban',i:'1554568218-0f1715e72254',co:['Blanco'],z:W,cl:['verano'],de:'Polo blanco con ilustración urbana y tela suave.'},
    {s:'polo-mujer-rojo',n:'Polo Rojo Statement',c:'polos',a:'Mujer',p:49,d:20,b:'msj-urban',i:'1529139574466-a303027c1d8b',co:['Rojo'],z:W,cl:['urbano'],de:'Rojo intenso con letras gráficas para looks con actitud.'},
    {s:'polo-algodon-pima',n:'Polo Algodón Pima',c:'polos',a:'Hombre',p:79,nw:1,b:'msj-essentials',i:'1529374255404-311a2a4f1fd9',co:['Blanco','Celeste'],z:M,cl:['basicos','oficina'],de:'Algodón pima peruano de fibra larga, suave y duradero.'},
    // Camisas
    {s:'camisa-oxford',n:'Camisa Oxford',c:'camisas',a:'Hombre',p:89,nw:1,b:'msj-essentials',i:'1598033129183-c4f50c736f10',co:['Blanco','Celeste'],z:M,cl:['oficina'],de:'Camisa de algodón oxford con cuello clásico.'},
    {s:'camisa-nube',n:'Camisa Denim Nube',c:'camisas',a:'Unisex',p:99,b:'msj-urban',i:'1596755094514-f87e34085b2c',co:['Azul claro'],z:U,cl:['urbano'],de:'Denim ligero con estampado de puntos y corte relajado.'},
    {s:'camisa-celeste-slim',n:'Camisa Celeste Slim',c:'camisas',a:'Hombre',p:109,b:'atelier-msj',i:'1620012253295-c15cc3e65df4',co:['Celeste'],z:M,cl:['oficina'],de:'Corte slim y tela antiarrugas para jornadas largas.'},
    {s:'camisa-blanca-formal',n:'Camisa Blanca Formal',c:'camisas',a:'Hombre',p:119,b:'atelier-msj',i:'1603252109303-2751441dd157',co:['Blanco'],z:M,cl:['oficina','noche'],de:'Popelina de algodón con puños dobles.'},
    {s:'camisa-lino',n:'Camisa Lino Color',c:'camisas',a:'Unisex',p:95,nw:1,b:'msj-essentials',i:'1626497764746-6dc36546b388',co:['Celeste','Verde','Rosa'],z:U,cl:['verano'],de:'Lino ligero y fresco en tonos suaves para días cálidos.'},
    {s:'sobrecamisa-cuadros',n:'Sobrecamisa a Cuadros',c:'camisas',a:'Hombre',p:129,d:15,b:'msj-urban',i:'1607345366928-199ea26cfe3e',co:['Verde','Rojo'],z:M,cl:['urbano','frio'],de:'Franela gruesa a cuadros que funciona como camisa o casaca ligera.'},
    // Blusas y tops
    {s:'blusa-floral',n:'Blusa Floral Primavera',c:'blusas',a:'Mujer',p:79,nw:1,b:'atelier-msj',i:'1564257631407-4deb1f99d992',co:['Blanco floral'],z:W,cl:['verano'],de:'Blusa fluida con estampado floral y cuello camisero.'},
    {s:'blusa-volantes-rosa',n:'Blusa Volantes Rosa',c:'blusas',a:'Mujer',p:89,b:'atelier-msj',i:'1581044777550-4cfa60707c03',co:['Rosa'],z:W,cl:['noche'],de:'Volantes en mangas y escote para un look romántico.'},
    {s:'top-alba',n:'Top Alba',c:'blusas',a:'Mujer',p:49,b:'msj-essentials',i:'1490481651871-ab68de25d43d',co:['Blanco','Crudo'],z:W,cl:['basicos','verano'],de:'Una base versátil de tacto suave y forma sencilla.'},
    {s:'blusa-saten',n:'Blusa Satén Noche',c:'blusas',a:'Mujer',p:99,d:10,b:'atelier-msj',i:'1551163943-3f6a855d1153',co:['Marfil','Negro'],z:W,cl:['noche','oficina'],de:'Satén con caída suave y botones forrados.'},
    {s:'poncho-tejido',n:'Poncho Tejido Andino',c:'blusas',a:'Mujer',p:119,nw:1,b:'msj-essentials',i:'1434389677669-e08b4cac3105',co:['Crudo'],z:['Única'],cl:['frio'],de:'Tejido calado con flecos, inspirado en la tradición andina.'},
    // Poleras y capuchas
    {s:'polera-crew',n:'Polera Capucha Gris',c:'poleras',a:'Unisex',p:119,d:15,b:'msj-urban',i:'1556821840-3a63f95609a7',co:['Gris jaspe','Negro'],z:U,cl:['urbano','frio','basicos'],de:'Capucha con forro de felpa, bolsillo canguro y puños elásticos.'},
    {s:'polera-capucha-urban',n:'Polera Capucha Urban',c:'poleras',a:'Hombre',p:129,nw:1,b:'msj-urban',i:'1542406775-ade58c52d2e4',co:['Gris'],z:M,cl:['urbano'],de:'Capucha amplia con estampado frontal y algodón perchado.'},
    {s:'polera-naranja-neon',n:'Polera Capucha Naranja',c:'poleras',a:'Unisex',p:139,b:'msj-urban',i:'1509942774463-acf339cf87d5',co:['Naranja'],z:U,cl:['urbano'],de:'Color vibrante para destacar; tela gruesa de alta densidad.'},
    {s:'polera-roja-capas',n:'Polera Capucha Roja',c:'poleras',a:'Hombre',p:125,d:10,b:'msj-urban',i:'1548126032-079a0fb0099d',co:['Rojo'],z:M,cl:['urbano','frio'],de:'Perfecta para usar en capas bajo casacas acolchadas.'},
    {s:'polera-crop',n:'Polera Blanca Cuello Redondo',c:'poleras',a:'Mujer',p:99,nw:1,b:'msj-essentials',i:'1620799140408-edc6dcb6d633',co:['Blanco','Beige'],z:W,cl:['basicos','frio'],de:'Polera de cuello redondo con interior afelpado.'},
    {s:'polera-negra-esencial',n:'Polera Capucha Negra',c:'poleras',a:'Unisex',p:115,b:'msj-essentials',i:'',co:['Negro'],z:U,cl:['basicos'],de:'La capucha negra que nunca falla.'},
    // Casacas
    {s:'chaqueta-norte',n:'Casaca Bomber Norte',c:'casacas',a:'Hombre',p:189,b:'msj-urban',i:'1591047139829-d91aecb6caea',co:['Terracota','Negro'],z:M,cl:['urbano'],de:'Bomber ligera de líneas limpias, con puños acanalados.'},
    {s:'casaca-cuero-marron',n:'Casaca Cuero Marrón',c:'casacas',a:'Hombre',p:349,nw:1,b:'andes-leather',i:'1487222477894-8943e31ef7b2',co:['Marrón'],z:M,cl:['urbano','noche'],de:'Cuero sintético de alta calidad con cierre asimétrico.'},
    {s:'casaca-cuero-negra',n:'Casaca Biker Negra',c:'casacas',a:'Hombre',p:329,d:20,b:'andes-leather',i:'1520975954732-35dd22299614',co:['Negro'],z:M,cl:['urbano','noche'],de:'Estilo biker con cierres metálicos y forro interior.'},
    {s:'casaca-biker-mujer',n:'Casaca Biker Mujer',c:'casacas',a:'Mujer',p:299,b:'andes-leather',i:'1551028719-00167b16eac5',co:['Negro'],z:W,cl:['urbano','noche'],de:'Biker entallada, ideal sobre vestidos o con jeans.'},
    {s:'casaca-denim-clasica',n:'Casaca Denim Clásica',c:'casacas',a:'Unisex',p:169,b:'msj-urban',i:'1495105787522-5334e3ffa0ef',co:['Azul claro'],z:U,cl:['urbano','basicos'],de:'Denim lavado con botones metálicos y bolsillos de parche.'},
    {s:'casaca-denim-oscura',n:'Casaca Denim Oscura',c:'casacas',a:'Unisex',p:179,nw:1,b:'msj-urban',i:'1543076447-215ad9ba6923',co:['Azul medio'],z:U,cl:['urbano'],de:'Denim de lavado medio, versátil para todo el año.'},
    {s:'abrigo-urbano',n:'Casaca Denim Sherpa',c:'casacas',a:'Hombre',p:229,nw:1,b:'msj-urban',i:'1544923246-77307dd654cb',co:['Azul oscuro'],z:M,cl:['frio','urbano'],de:'Denim con cuello y forro de sherpa para los días fríos.'},
    {s:'casaca-denim-cuello-pana',n:'Casaca Denim Cuello Pana',c:'casacas',a:'Hombre',p:209,b:'msj-urban',i:'1611312449408-fcece27cdbb7',co:['Azul'],z:M,cl:['frio'],de:'Cuello de pana y forro abrigador en un clásico renovado.'},
    {s:'casaca-denim-mujer',n:'Casaca Denim Mujer',c:'casacas',a:'Mujer',p:169,d:15,b:'msj-urban',i:'1539109136881-3be0616acf4b',co:['Celeste'],z:W,cl:['urbano'],de:'Corte recto y lavado claro para combinar con todo.'},
    {s:'casaca-shearling-mujer',n:'Casaca Shearling Mujer',c:'casacas',a:'Mujer',p:319,nw:1,b:'andes-leather',i:'1608063615781-e2ef8c73d114',co:['Marrón'],z:W,cl:['frio'],de:'Exterior efecto ante y forro de borrego súper abrigador.'},
    {s:'casaca-aviador',n:'Casaca Aviador',c:'casacas',a:'Hombre',p:339,b:'andes-leather',i:'1559551409-dadc959f76b8',co:['Marrón'],z:M,cl:['frio'],de:'Inspiración aviador con cuello de borrego desmontable.'},
    {s:'casaca-acolchada',n:'Casaca Acolchada Puffer',c:'casacas',a:'Unisex',p:249,nw:1,b:'msj-active',i:'',co:['Negro','Verde oliva'],z:U,cl:['frio','deportivo'],de:'Relleno ligero, capucha y repelencia al agua.'},
    {s:'casaca-cortavientos',n:'Casaca Cortavientos',c:'casacas',a:'Unisex',p:159,d:10,b:'msj-active',i:'',co:['Azul','Negro'],z:U,cl:['deportivo'],de:'Tela técnica liviana, plegable en su propio bolsillo.'},
    // Abrigos
    {s:'abrigo-pano',n:'Abrigo Paño Camel',c:'abrigos',a:'Mujer',p:349,d:20,b:'atelier-msj',i:'1539533018447-63fcce2678e3',co:['Camel'],z:W,cl:['frio','oficina'],de:'Paño de lana mezclada con solapa amplia y cinturón.'},
    {s:'abrigo-cuadros',n:'Abrigo a Cuadros',c:'abrigos',a:'Mujer',p:329,nw:1,b:'atelier-msj',i:'1485968579580-b6d095142e6e',co:['Verde cuadros'],z:W,cl:['frio'],de:'Cuadros escoceses en un abrigo de largo medio.'},
    {s:'abrigo-pied-de-poule',n:'Abrigo Pied de Poule',c:'abrigos',a:'Mujer',p:359,b:'atelier-msj',i:'1525450824786-227cbef70703',co:['Blanco y negro'],z:W,cl:['frio','oficina'],de:'Estampado clásico pied de poule con botones forrados.'},
    {s:'abrigo-negro-largo',n:'Abrigo Negro Largo',c:'abrigos',a:'Mujer',p:379,b:'atelier-msj',i:'1554412933-514a83d2f3c8',co:['Negro'],z:W,cl:['frio','noche'],de:'Largo elegante con detalles de volantes en el frente.'},
    {s:'abrigo-borgona',n:'Abrigo Borgoña',c:'abrigos',a:'Mujer',p:369,nw:1,b:'atelier-msj',i:'1483985988355-763728e1935b',co:['Borgoña'],z:W,cl:['frio','noche'],de:'Color profundo y cuello alto para las noches frías.'},
    {s:'abrigo-hombre-lana',n:'Abrigo Hombre Lana',c:'abrigos',a:'Hombre',p:389,b:'atelier-msj',i:'',co:['Gris','Camel'],z:M,cl:['frio','oficina'],de:'Abrigo recto de lana para usar sobre terno o casual.'},
    // Chompas
    {s:'chompa-margaritas-verde',n:'Chompa Margaritas Verde Bosque',c:'chompas',a:'Mujer',p:149,nw:1,b:'atelier-msj',i:'1760127537832-0bae1e09bfbb',co:['Verde bosque'],z:W,cl:['frio','basicos'],de:'Punto suave con margaritas bordadas a mano. Ideal para las fiestas de fin de año.'},
    {s:'chompa-trenzada',n:'Chompa Trenzada',c:'chompas',a:'Hombre',p:139,d:10,b:'msj-essentials',i:'',co:['Crudo','Azul marino'],z:M,cl:['frio'],de:'Tejido cálido de punto con textura trenzada.'},
    {s:'chompa-suave',n:'Chompa Cuello Alto',c:'chompas',a:'Mujer',p:129,nw:1,b:'msj-essentials',i:'1516762689617-e1cffcef479d',co:['Crudo','Beige'],z:W,cl:['frio','basicos'],de:'Punto ligero y cómodo con cuello alto.'},
    {s:'sueter-punto',n:'Chompa Alpaca Mezcla',c:'chompas',a:'Unisex',p:189,nw:1,b:'msj-essentials',i:'',co:['Gris','Marrón'],z:U,cl:['frio'],de:'Mezcla con alpaca peruana: abriga sin pesar.'},
    {s:'cardigan-botones',n:'Cárdigan con Botones',c:'chompas',a:'Mujer',p:119,b:'msj-essentials',i:'',co:['Negro','Crema'],z:W,cl:['oficina','basicos'],de:'Cárdigan de punto fino, perfecto para capas.'},
    // Blazers y ternos
    {s:'terno-clasico-negro',n:'Terno Clásico Negro',c:'blazers',a:'Hombre',p:499,b:'atelier-msj',i:'1507679799987-c73779587ccf',co:['Negro'],z:M,cl:['oficina','noche'],de:'Saco y pantalón de corte moderno en tela fría.'},
    {s:'terno-azul-cuadros',n:'Terno Azul a Cuadros',c:'blazers',a:'Hombre',p:549,nw:1,b:'atelier-msj',i:'1594938298603-c8148c4dae35',co:['Azul'],z:M,cl:['oficina','noche'],de:'Cuadros sutiles y chaleco a juego para un look completo.'},
    {s:'blazer-azul-slim',n:'Blazer Azul Slim',c:'blazers',a:'Hombre',p:289,d:15,b:'atelier-msj',i:'1617137968427-85924c800a22',co:['Azul marino'],z:M,cl:['oficina'],de:'Blazer entallado que también va con jeans.'},
    {s:'saco-ejecutivo',n:'Saco Ejecutivo',c:'blazers',a:'Hombre',p:319,b:'atelier-msj',i:'1610652492500-ded49ceeb378',co:['Negro','Gris'],z:M,cl:['oficina'],de:'Hombros estructurados y forro interior completo.'},
    {s:'blazer-mujer-oversize',n:'Blazer Mujer Oversize',c:'blazers',a:'Mujer',p:259,nw:1,b:'atelier-msj',i:'',co:['Beige','Negro'],z:W,cl:['oficina'],de:'Silueta amplia con hombreras suaves.'},
    // Jeans
    {s:'jean-rasgado-hombre',n:'Jean Rasgado Slim',c:'jeans',a:'Hombre',p:139,b:'msj-urban',i:'1541099649105-f69ad21f3246',co:['Azul'],z:JM,cl:['urbano'],de:'Slim fit con rasgados en rodillas y elastano para comodidad.'},
    {s:'jean-clasico-recto',n:'Jean Clásico Recto',c:'jeans',a:'Hombre',p:129,b:'msj-essentials',i:'1542272604-787c3835535d',co:['Azul oscuro','Negro'],z:JM,cl:['basicos'],de:'Corte recto atemporal en denim rígido.'},
    {s:'jean-stone-wash',n:'Jean Stone Wash',c:'jeans',a:'Unisex',p:135,d:15,b:'msj-urban',i:'1565084888279-aca607ecce0c',co:['Celeste','Azul'],z:JM,cl:['basicos'],de:'Lavado stone para un look desgastado natural.'},
    {s:'jean-skinny-negro',n:'Jean Skinny Oscuro',c:'jeans',a:'Hombre',p:139,b:'msj-urban',i:'1604176354204-9268737828e4',co:['Azul noche'],z:JM,cl:['urbano'],de:'Ajuste skinny con denim elástico de alta recuperación.'},
    {s:'jean-tapered',n:'Jean Tapered Urbano',c:'jeans',a:'Hombre',p:149,nw:1,b:'msj-urban',i:'1582552938357-32b906df40cb',co:['Celeste'],z:JM,cl:['urbano'],de:'Amplio arriba y estrecho al tobillo, ideal con zapatillas.'},
    {s:'jean-relaxed-indigo',n:'Jean Relaxed Índigo',c:'jeans',a:'Hombre',p:145,b:'msj-essentials',i:'1638247025967-b4e38f787b76',co:['Índigo'],z:JM,cl:['basicos'],de:'Denim índigo profundo con corte relajado.'},
    {s:'pantalon-trazo',n:'Jean Mom Tiro Alto',c:'jeans',a:'Mujer',p:129,nw:1,b:'msj-urban',i:'1598554747436-c9293d6a588f',co:['Celeste'],z:JW,cl:['urbano','basicos'],de:'Tiro alto, pierna recta y bastas al tobillo.'},
    {s:'jean-wide-leg',n:'Jean Wide Leg',c:'jeans',a:'Mujer',p:149,b:'msj-urban',i:'1525507119028-ed4c629a60a3',co:['Azul'],z:JW,cl:['urbano'],de:'Pierna ancha y fluida, tendencia que llegó para quedarse.'},
    // Pantalones
    {s:'pantalon-chino-khaki',n:'Pantalón Chino Khaki',c:'pantalones',a:'Hombre',p:119,b:'msj-essentials',i:'1473966968600-fa801b869a1a',co:['Khaki','Azul marino'],z:JM,cl:['oficina','basicos'],de:'Chino de drill con elastano y corte slim.'},
    {s:'pantalon-negro-vestir',n:'Pantalón Negro de Vestir',c:'pantalones',a:'Hombre',p:129,b:'atelier-msj',i:'1624378439575-d8705ad7ae80',co:['Negro'],z:JM,cl:['oficina'],de:'Tela fría con pinza delantera y caída impecable.'},
    {s:'pantalon-rayas-mujer',n:'Pantalón a Rayas',c:'pantalones',a:'Mujer',p:119,nw:1,b:'atelier-msj',i:'1509631179647-0177331693ae',co:['Negro y blanco'],z:W,cl:['noche'],de:'Pierna amplia con rayas verticales que estilizan.'},
    {s:'pantalon-cargo-mujer',n:'Pantalón Cargo Mujer',c:'pantalones',a:'Mujer',p:125,b:'msj-urban',i:'1552902865-b72c031ac5ea',co:['Negro','Verde oliva'],z:W,cl:['urbano'],de:'Bolsillos laterales y puños ajustables.'},
    {s:'pantalon-mostaza',n:'Pantalón Mostaza Urbano',c:'pantalones',a:'Unisex',p:115,d:20,b:'msj-urban',i:'1517438476312-10d79c077509',co:['Mostaza'],z:U,cl:['urbano'],de:'Color protagonista para looks con zapatillas.'},
    // Joggers
    {s:'jogger-azul-suave',n:'Jogger Azul Suave',c:'joggers',a:'Mujer',p:99,b:'msj-active',i:'1506629082955-511b1aa562c8',co:['Celeste','Gris'],z:W,cl:['deportivo','basicos'],de:'Felpa liviana con pretina elástica y cordón.'},
    {s:'jogger-rosa',n:'Jogger Rosa Pastel',c:'joggers',a:'Mujer',p:95,d:10,b:'msj-active',i:'1594633312681-425c7b97ccd1',co:['Rosa'],z:W,cl:['deportivo'],de:'Tono pastel y puños en el tobillo.'},
    {s:'jogger-hombre-negro',n:'Jogger Hombre Negro',c:'joggers',a:'Hombre',p:105,nw:1,b:'msj-active',i:'',co:['Negro','Gris'],z:M,cl:['deportivo','urbano'],de:'Bolsillos con cierre y tela que no se deforma.'},
    // Shorts
    {s:'short-denim-mujer',n:'Short Denim Rasgado',c:'shorts',a:'Mujer',p:79,b:'msj-urban',i:'1591195853828-11db59a44f6b',co:['Celeste'],z:JW,cl:['verano'],de:'Tiro alto, bastas deshilachadas y lavado claro.'},
    {s:'short-hombre-rojo',n:'Short Chino Rojo',c:'shorts',a:'Hombre',p:75,d:15,b:'msj-essentials',i:'1617952236317-0bd127407984',co:['Rojo','Azul'],z:M,cl:['verano'],de:'Chino corto para playa o ciudad.'},
    {s:'short-blanco-mujer',n:'Short Blanco Lino',c:'shorts',a:'Mujer',p:85,nw:1,b:'msj-essentials',i:'1475180098004-ca77a66827be',co:['Blanco'],z:W,cl:['verano'],de:'Lino fresco con pretina elástica.'},
    // Vestidos
    {s:'vestido-lentejuelas-champan',n:'Vestido Lentejuelas Champán',c:'vestidos',a:'Mujer',p:259,nw:1,b:'atelier-msj',i:'1772615071677-6441340349fd',co:['Champán'],z:W,cl:['noche'],de:'Lentejuelas tono champán y manga larga para brillar en Año Nuevo.'},
    {s:'vestido-lentejuelas-azul-noche',n:'Vestido Lentejuelas Azul Noche',c:'vestidos',a:'Mujer',p:239,nw:1,b:'atelier-msj',i:'1779406274768-776e7064242b',co:['Azul noche'],z:W,cl:['noche'],de:'Tirantes finos y lentejuelas azul profundo para cenas y fiestas.'},
    {s:'vestido-flecos-dorados',n:'Vestido Flecos Dorados',c:'vestidos',a:'Mujer',p:269,nw:1,b:'atelier-msj',i:'1789972181238-624c83e47cd4',co:['Dorado'],z:W,cl:['noche'],de:'Flecos con movimiento y brillo dorado: el look de la medianoche.'},
    {s:'vestido-brisa',n:'Vestido Brisa Floral',c:'vestidos',a:'Mujer',p:139,b:'atelier-msj',i:'1496747611176-843222e1e57c',co:['Floral'],z:W,cl:['verano'],de:'Una prenda fresca de movimiento natural.'},
    {s:'vestido-elegante',n:'Vestido Blanco Hombros Descubiertos',c:'vestidos',a:'Mujer',p:149,nw:1,b:'atelier-msj',i:'1515372039744-b8f02a3ae446',co:['Blanco'],z:W,cl:['verano','noche'],de:'Escote off-shoulder y falda con vuelo.'},
    {s:'vestido-encaje-azul',n:'Vestido Encaje Azul',c:'vestidos',a:'Mujer',p:229,b:'atelier-msj',i:'1551803091-e20673f15770',co:['Azul'],z:W,cl:['noche'],de:'Encaje con aberturas laterales para eventos de noche.'},
    {s:'vestido-morado-satin',n:'Vestido Satín Morado',c:'vestidos',a:'Mujer',p:209,d:15,b:'atelier-msj',i:'1566174053879-31528523f8ae',co:['Morado'],z:W,cl:['noche'],de:'Satín con hombros descubiertos y caída elegante.'},
    {s:'vestido-rojo-cinturon',n:'Vestido Rojo con Cinturón',c:'vestidos',a:'Mujer',p:179,nw:1,b:'atelier-msj',i:'1572804013309-59a88b7e92f1',co:['Rojo'],z:W,cl:['noche','verano'],de:'Cintura marcada y falda midi con vuelo.'},
    {s:'vestido-midi-vino',n:'Vestido Midi Vino',c:'vestidos',a:'Mujer',p:159,b:'atelier-msj',i:'1585487000160-6ebcfceb0d03',co:['Vino'],z:W,cl:['oficina'],de:'Botones al frente y manga tres cuartos.'},
    {s:'vestido-camisero-denim',n:'Vestido Camisero Denim',c:'vestidos',a:'Mujer',p:149,b:'msj-urban',i:'1591369822096-ffd140ec948f',co:['Azul'],z:W,cl:['urbano','basicos'],de:'Denim liviano con botones a presión y bolsillos.'},
    {s:'vestido-largo-rojo',n:'Vestido Largo Rojo',c:'vestidos',a:'Mujer',p:259,nw:1,b:'atelier-msj',i:'1595777457583-95e059d581b8',co:['Rojo'],z:W,cl:['noche'],de:'Largo fluido que se mueve contigo.'},
    {s:'vestido-cruzado-rojo',n:'Vestido Cruzado Rojo',c:'vestidos',a:'Mujer',p:199,d:20,b:'atelier-msj',i:'1612336307429-8a898d10e223',co:['Rojo'],z:W,cl:['noche'],de:'Escote cruzado y abertura lateral.'},
    {s:'vestido-azul-playa',n:'Vestido Azul Playa',c:'vestidos',a:'Mujer',p:129,b:'atelier-msj',i:'1539008835657-9e8e9680c956',co:['Celeste'],z:W,cl:['verano'],de:'Tela vaporosa ideal para días de playa.'},
    // Faldas
    {s:'falda-plisada',n:'Falda Plisada Midi',c:'faldas',a:'Mujer',p:99,nw:1,b:'atelier-msj',i:'1577900232427-18219b9166a0',co:['Rosa palo','Negro'],z:W,cl:['oficina','noche'],de:'Plisado fino con pretina elástica oculta.'},
    {s:'falda-beige-asimetrica',n:'Falda Beige Asimétrica',c:'faldas',a:'Mujer',p:95,b:'atelier-msj',i:'1592301933927-35b597393c0a',co:['Beige'],z:W,cl:['verano'],de:'Basta asimétrica con movimiento.'},
    {s:'falda-negra-vuelo',n:'Falda Negra con Vuelo',c:'faldas',a:'Mujer',p:89,d:10,b:'msj-essentials',i:'1583496661160-fb5886a0aaaa',co:['Negro'],z:W,cl:['basicos','oficina'],de:'Corta, con vuelo y tiro alto.'},
    // Conjuntos y deportivo
    {s:'conjunto-buzo-amarillo',n:'Conjunto Buzo Amarillo',c:'conjuntos',a:'Mujer',p:179,nw:1,b:'msj-active',i:'1515886657613-9f3515b0c78f',co:['Amarillo'],z:W,cl:['deportivo','urbano'],de:'Casaca y pantalón a juego en felpa suave.'},
    {s:'conjunto-dos-piezas',n:'Conjunto Dos Piezas',c:'conjuntos',a:'Mujer',p:169,b:'atelier-msj',i:'1550614000-4895a10e1bfd',co:['Rojo'],z:W,cl:['noche','verano'],de:'Top y falda a juego con estampado vibrante.'},
    {s:'legging-deportivo',n:'Legging Deportivo',c:'conjuntos',a:'Mujer',p:89,b:'msj-active',i:'1571019613454-1cb2f99b2d8b',co:['Naranja','Negro'],z:W,cl:['deportivo'],de:'Tiro alto, compresión media y secado rápido.'},
    {s:'legging-yoga',n:'Legging Yoga Soft',c:'conjuntos',a:'Mujer',p:85,d:10,b:'msj-active',i:'1518459031867-a89b944bffe4',co:['Negro','Gris'],z:W,cl:['deportivo'],de:'Tela ultra suave para yoga y pilates.'},
    {s:'buzo-hombre-completo',n:'Buzo Hombre Completo',c:'conjuntos',a:'Hombre',p:189,nw:1,b:'msj-active',i:'',co:['Negro','Azul'],z:M,cl:['deportivo'],de:'Casaca con cierre y pantalón jogger a juego.'},
    // Zapatillas
    {s:'zapatillas-urbanas',n:'Zapatillas Runner Rojas',c:'zapatillas',a:'Unisex',p:229,b:'msj-active',i:'1542291026-7eec264c27ff',co:['Rojo'],z:SU,cl:['deportivo'],de:'Malla transpirable y suela con amortiguación.'},
    {s:'zapatillas-flotante-negra',n:'Zapatillas Knit Negras',c:'zapatillas',a:'Unisex',p:219,nw:1,b:'msj-active',i:'1491553895911-0055eca6402d',co:['Negro'],z:SU,cl:['deportivo','urbano'],de:'Tejido knit sin costuras que se adapta al pie.'},
    {s:'zapatillas-botin-blancas',n:'Zapatillas Caña Alta Blancas',c:'zapatillas',a:'Unisex',p:249,b:'msj-urban',i:'1512374382149-233c42b6a83b',co:['Blanco'],z:SU,cl:['urbano'],de:'Caña alta de cuero sintético con suela vulcanizada.'},
    {s:'zapatillas-retro-colores',n:'Zapatillas Retro Color',c:'zapatillas',a:'Unisex',p:239,d:15,b:'msj-urban',i:'1520256862855-398228c41684',co:['Azul y rosa'],z:SU,cl:['urbano'],de:'Inspiración noventera con paneles de colores.'},
    {s:'zapatillas-skate-vino',n:'Zapatillas Skate Vino',c:'zapatillas',a:'Unisex',p:179,b:'msj-urban',i:'1525966222134-fcfa99b8ae77',co:['Vino'],z:SU,cl:['urbano'],de:'Lona resistente y suela plana con gran agarre.'},
    {s:'zapatillas-running-gris',n:'Zapatillas Running Gris',c:'zapatillas',a:'Hombre',p:259,nw:1,b:'msj-active',i:'1539185441755-769473a23570',co:['Gris'],z:SM,cl:['deportivo'],de:'Para correr a diario con soporte y ligereza.'},
    {s:'zapatillas-camel',n:'Zapatillas Camel Cuero',c:'zapatillas',a:'Hombre',p:269,b:'andes-leather',i:'1549298916-b41d501d3772',co:['Camel'],z:SM,cl:['urbano'],de:'Cuero nobuk y suela de goma bicolor.'},
    {s:'zapatillas-rosa-runner',n:'Zapatillas Runner Rosa',c:'zapatillas',a:'Mujer',p:239,nw:1,b:'msj-active',i:'1551107696-a4b0c5a0d9a2',co:['Rosa','Blanco'],z:SW,cl:['deportivo'],de:'Diseño chunky con capas de malla y gamuza.'},
    {s:'zapatillas-blancas-clasicas',n:'Zapatillas Blancas Clásicas',c:'zapatillas',a:'Unisex',p:199,b:'msj-essentials',i:'1587563871167-1ee9c731aefb',co:['Blanco'],z:SU,cl:['basicos','urbano'],de:'Las blancas que combinan con todo tu clóset.'},
    {s:'zapatillas-pastel',n:'Zapatillas Pastel',c:'zapatillas',a:'Mujer',p:229,d:10,b:'msj-urban',i:'1595950653106-6c9ebd614d3a',co:['Pastel'],z:SW,cl:['urbano','verano'],de:'Paneles en tonos pastel sobre base blanca.'},
    {s:'zapatillas-beige-minimal',n:'Zapatillas Beige Minimal',c:'zapatillas',a:'Unisex',p:209,nw:1,b:'msj-essentials',i:'1603808033192-082d6919d3e1',co:['Beige'],z:SU,cl:['basicos'],de:'Silueta minimalista en gamuza y cuero.'},
    // Zapatos
    {s:'mocasin-gamuza-camel',n:'Mocasín Gamuza Camel',c:'zapatos',a:'Hombre',p:229,nw:1,b:'andes-leather',i:'1576792741377-eb0f4f6d1a47',co:['Camel'],z:SM,cl:['oficina','minimal-luxury'],de:'Gamuza suave con antifaz clásico y suela flexible.'},
    {s:'mocasin-horsebit-conac',n:'Mocasín Horsebit Coñac',c:'zapatos',a:'Hombre',p:279,b:'andes-leather',i:'1615979474401-8a6a344de5bd',co:['Coñac'],z:SM,cl:['oficina','noche'],de:'Cuero pulido con herraje metálico. Elegancia para la oficina y la noche.'},
    {s:'mocasin-gamuza-hebilla',n:'Mocasín Gamuza con Hebilla',c:'zapatos',a:'Mujer',p:219,nw:1,b:'andes-leather',i:'1676121270762-47c8d3a7b9d5',co:['Tabaco'],z:SW,cl:['oficina','minimal-luxury'],de:'Gamuza tabaco con hebilla dorada y plantilla acolchada.'},
    {s:'mocasin-charol-plataforma',n:'Mocasín Charol Plataforma',c:'zapatos',a:'Unisex',p:199,nw:1,b:'msj-urban',i:'1760616172899-0681b97a2de3',co:['Negro charol'],z:SU,cl:['urbano','noche'],de:'Charol negro con suela gruesa: clásico con actitud.'},
    {s:'zapatos-derby-marron',n:'Zapatos Derby Marrón',c:'zapatos',a:'Hombre',p:259,b:'andes-leather',i:'1449505278894-297fdb3edbc1',co:['Marrón'],z:SM,cl:['oficina'],de:'Cuero genuino con acabado brillante.'},
    {s:'zapatos-monk',n:'Zapatos Doble Hebilla',c:'zapatos',a:'Hombre',p:289,nw:1,b:'andes-leather',i:'1533867617858-e7b97e060509',co:['Marrón'],z:SM,cl:['oficina','noche'],de:'Monk strap de doble hebilla para looks formales.'},
    {s:'zapatos-oxford-cuero',n:'Zapatos Oxford Cuero',c:'zapatos',a:'Hombre',p:269,d:15,b:'andes-leather',i:'1614252235316-8c857d38b5f4',co:['Coñac'],z:SM,cl:['oficina'],de:'Oxford clásico con suela de cuero cosida.'},
    // Botas
    {s:'botas-cuero-trabajo',n:'Botas Cuero Outdoor',c:'botas',a:'Hombre',p:299,b:'andes-leather',i:'1520639888713-7851133b1ed0',co:['Marrón'],z:SM,cl:['frio'],de:'Cuero engrasado y suela de alta tracción.'},
    {s:'botines-marrones',n:'Botines Marrones',c:'botas',a:'Hombre',p:279,nw:1,b:'andes-leather',i:'1605812860427-4024433a70fd',co:['Marrón'],z:SM,cl:['frio','urbano'],de:'Botín con cordones y plantilla acolchada.'},
    {s:'botines-chelsea-negros',n:'Botines Chelsea Oscuros',c:'botas',a:'Unisex',p:289,b:'andes-leather',i:'1608256246200-53e635b5b65f',co:['Café oscuro'],z:SU,cl:['frio','oficina'],de:'Elásticos laterales para ponerlos y quitarlos fácil.'},
    {s:'botas-casual-combo',n:'Botas Casual',c:'botas',a:'Hombre',p:249,d:10,b:'andes-leather',i:'1479064555552-3ef4979f8908',co:['Marrón'],z:SM,cl:['frio'],de:'Botas de cuero para tus looks de fin de semana.'},
    {s:'botas-mujer-cana-alta',n:'Botas Mujer Caña Alta',c:'botas',a:'Mujer',p:319,nw:1,b:'andes-leather',i:'',co:['Negro','Camel'],z:SW,cl:['frio','noche'],de:'Caña alta con taco bajo y cierre lateral.'},
    // Sandalias y tacones
    {s:'sandalias-plataforma-rojas',n:'Sandalias Plataforma',c:'sandalias',a:'Mujer',p:149,b:'msj-essentials',i:'1562273138-f46be4ebdf33',co:['Rojo vino'],z:SW,cl:['verano'],de:'Plataforma de corcho y tiras cruzadas.'},
    {s:'sandalias-corcho',n:'Sandalias Corcho Hebillas',c:'sandalias',a:'Unisex',p:139,nw:1,b:'msj-essentials',i:'1603487742131-4160ec999306',co:['Beige','Negro'],z:SU,cl:['verano'],de:'Plantilla anatómica de corcho y hebillas regulables.'},
    {s:'tacones-aura',n:'Tacones Aura Estampados',c:'tacones',a:'Mujer',p:189,b:'atelier-msj',i:'1543163521-1bf539c55dd2',co:['Multicolor'],z:SW,cl:['noche'],de:'Stiletto con estampado artístico.'},
    {s:'tacones-nude',n:'Tacones Nude Clásicos',c:'tacones',a:'Mujer',p:179,nw:1,b:'atelier-msj',i:'1535043934128-cf0b28d52f95',co:['Nude'],z:SW,cl:['noche','oficina'],de:'Punta fina y taco de 9 cm que alarga la silueta.'},
    // Gorras y gorros
    {s:'gorro-trenzado-pompon',n:'Gorro Trenzado con Pompón',c:'gorras',a:'Unisex',p:59,nw:1,b:'msj-essentials',i:'1576529598261-96e376f6aabb',co:['Mostaza'],z:ONE,cl:['frio','otono-invierno'],de:'Punto trenzado grueso con pompón. Abrigo y color para el invierno.'},
    {s:'gorro-acanalado-mostaza',n:'Gorro Acanalado Pescador',c:'gorras',a:'Unisex',p:49,b:'msj-urban',i:'1630691650107-53dd500d2907',co:['Mostaza'],z:ONE,cl:['frio','urbano'],de:'Tejido acanalado de ajuste corto, estilo pescador.'},
    {s:'gorra-msj-classic',n:'Gorra Trucker Blanca',c:'gorras',a:'Unisex',p:49,b:'msj-urban',i:'1588850561407-ed78c282e89b',co:['Blanco'],z:ONE,cl:['urbano','verano'],de:'Malla trasera y cierre regulable.'},
    {s:'gorra-gris-lavada',n:'Gorra Gris Lavada',c:'gorras',a:'Unisex',p:45,d:10,b:'msj-urban',i:'1521369909029-2afed882baee',co:['Gris'],z:ONE,cl:['urbano','basicos'],de:'Algodón lavado con visera curva.'},
    {s:'gorra-beige-bordada',n:'Gorra Beige Bordada',c:'gorras',a:'Unisex',p:55,nw:1,b:'msj-urban',i:'1575428652377-a2d80e2277fc',co:['Beige'],z:ONE,cl:['verano'],de:'Bordado lateral y hebilla metálica.'},
    {s:'gorra-dad-hat',n:'Gorra Dad Hat',c:'gorras',a:'Hombre',p:45,b:'msj-urban',i:'1534215754734-18e55d13e346',co:['Celeste'],z:ONE,cl:['urbano'],de:'Perfil bajo y tela suave estructurada.'},
    {s:'gorra-blanca-curva',n:'Gorra Blanca Visera Curva',c:'gorras',a:'Hombre',p:49,b:'msj-active',i:'1622445275576-721325763afe',co:['Blanco'],z:ONE,cl:['deportivo'],de:'Tela técnica que absorbe el sudor.'},
    {s:'gorros-lana',n:'Gorro de Lana',c:'gorras',a:'Unisex',p:39,nw:1,b:'msj-essentials',i:'1576871337632-b9aef4c17ab9',co:['Negro','Rosa','Verde'],z:ONE,cl:['frio'],de:'Punto acanalado con doblez en el borde.'},
    // Bolsos
    {s:'bolso-linea',n:'Bolso Línea Rojo',c:'bolsos',a:'Mujer',p:189,b:'andes-leather',i:'1584917865442-de89df76afd3',co:['Rojo'],z:ONE,cl:['noche'],de:'Bolso estructurado con asa superior y correa larga.'},
    {s:'cartera-rosa',n:'Cartera Rosa Cadena',c:'bolsos',a:'Mujer',p:149,nw:1,b:'andes-leather',i:'1566150905458-1bf1fc113f0d',co:['Rosa'],z:ONE,cl:['noche','verano'],de:'Cartera compacta con correa de cadena.'},
    {s:'bolso-croco',n:'Bolso Efecto Croco',c:'bolsos',a:'Mujer',p:199,d:15,b:'andes-leather',i:'1575032617751-6ddec2089882',co:['Vino'],z:ONE,cl:['noche'],de:'Textura croco y herraje dorado.'},
    {s:'bolso-mimbre',n:'Bolso de Mimbre',c:'bolsos',a:'Mujer',p:169,b:'msj-essentials',i:'1590874103328-eac38a683ce7',co:['Naranja'],z:ONE,cl:['verano'],de:'Tejido de mimbre con detalles de cuero.'},
    {s:'bolso-turquesa',n:'Bolso Turquesa',c:'bolsos',a:'Mujer',p:179,nw:1,b:'andes-leather',i:'1594223274512-ad4803739b7c',co:['Turquesa'],z:ONE,cl:['oficina'],de:'Amplio interior con bolsillo con cierre.'},
    // Mochilas
    {s:'mochila-urbana',n:'Mochila Urbana Azul',c:'mochilas',a:'Unisex',p:129,b:'msj-urban',i:'1553062407-98eeb64c6a62',co:['Azul marino'],z:ONE,cl:['urbano','basicos'],de:'Compartimento acolchado para laptop de 15".'},
    {s:'mochila-negra',n:'Mochila Negra Esencial',c:'mochilas',a:'Unisex',p:119,d:10,b:'msj-essentials',i:'1581605405669-fcdf81165afa',co:['Negro'],z:ONE,cl:['basicos'],de:'Ligera, resistente al agua y con bolsillo frontal.'},
    {s:'mochila-cuero',n:'Mochila de Cuero',c:'mochilas',a:'Unisex',p:249,nw:1,b:'andes-leather',i:'1622560480605-d83c853bc5c3',co:['Marrón'],z:ONE,cl:['oficina'],de:'Cuero que mejora con el tiempo y herrajes metálicos.'},
    // Lentes
    {s:'lentes-sol-msj',n:'Lentes Redondos Dorados',c:'lentes',a:'Unisex',p:89,b:'lumen',i:'1511499767150-a48a237f0083',co:['Dorado'],z:ONE,cl:['verano'],de:'Montura metálica redonda con protección UV400.'},
    {s:'lentes-aviador',n:'Lentes Aviador',c:'lentes',a:'Unisex',p:99,nw:1,b:'lumen',i:'1473496169904-658ba7c44d8a',co:['Negro'],z:ONE,cl:['verano'],de:'Clásico aviador con lunas polarizadas.'},
    {s:'lentes-cat-eye',n:'Lentes Cat Eye',c:'lentes',a:'Mujer',p:95,b:'lumen',i:'1508296695146-257a814070b4',co:['Rosado'],z:ONE,cl:['verano','noche'],de:'Forma ojo de gato con lunas degradadas.'},
    {s:'lentes-wayfarer',n:'Lentes Clásicos Negros',c:'lentes',a:'Unisex',p:89,d:10,b:'lumen',i:'1572635196237-14b3f281503f',co:['Negro'],z:ONE,cl:['basicos'],de:'Montura de acetato negra atemporal.'},
    {s:'lentes-playa',n:'Lentes Playa Ámbar',c:'lentes',a:'Unisex',p:85,b:'lumen',i:'1577803645773-f96470509666',co:['Ámbar'],z:ONE,cl:['verano'],de:'Montura transparente y lunas ámbar.'},
    // Relojes
    {s:'reloj-negro-minimal',n:'Reloj Negro Minimal',c:'relojes',a:'Hombre',p:199,b:'lumen',i:'1434056886845-dac89ffe9b56',co:['Negro'],z:ONE,cl:['oficina'],de:'Esfera negra limpia y correa de cuero.'},
    {s:'reloj-oro-rosa',n:'Reloj Oro Rosa',c:'relojes',a:'Mujer',p:229,nw:1,b:'lumen',i:'1522312346375-d1a52e2b99b3',co:['Oro rosa'],z:ONE,cl:['noche'],de:'Caja en tono oro rosa y correa de malla.'},
    {s:'reloj-cronografo',n:'Reloj Cronógrafo',c:'relojes',a:'Hombre',p:279,b:'lumen',i:'1542496658-e33a6d0d50f6',co:['Plateado'],z:ONE,cl:['oficina'],de:'Tres subesferas y resistencia al agua 5 ATM.'},
    {s:'reloj-clasico-blanco',n:'Reloj Clásico Esfera Blanca',c:'relojes',a:'Unisex',p:189,d:15,b:'lumen',i:'1524592094714-0f0654e20314',co:['Marrón'],z:ONE,cl:['basicos'],de:'Diseño minimalista con correa de cuero.'},
    {s:'reloj-inteligente-blanco',n:'Reloj Inteligente Blanco',c:'relojes',a:'Unisex',p:249,nw:1,b:'lumen',i:'1523275335684-37898b6baf30',co:['Blanco'],z:ONE,cl:['deportivo'],de:'Mide pasos, ritmo cardiaco y sueño.'},
    // Joyería
    {s:'collar-dorado',n:'Collar Dorado Fino',c:'joyeria',a:'Mujer',p:69,b:'lumen',i:'1611652022419-a9419f74343d',co:['Dorado'],z:ONE,cl:['noche'],de:'Cadena delicada para sumar brillo.'},
    {s:'aretes-minimal',n:'Aretes Joya Azul',c:'joyeria',a:'Mujer',p:59,b:'lumen',i:'1535632066927-ab7c9ab60908',co:['Plateado'],z:ONE,cl:['noche'],de:'Aretes con piedra azul y engaste brillante.'},
    {s:'collar-perlas',n:'Collar de Perlas',c:'joyeria',a:'Mujer',p:89,nw:1,b:'lumen',i:'1515562141207-7a88fb7ce338',co:['Perla'],z:ONE,cl:['noche','oficina'],de:'Perlas simuladas de brillo nacarado.'},
    {s:'dije-luna',n:'Collar Dije Gema',c:'joyeria',a:'Mujer',p:65,b:'lumen',i:'1599643478518-a784e5dc4c8f',co:['Dorado'],z:ONE,cl:['noche'],de:'Dije con gema facetada y cadena regulable.'},
    {s:'pulsera-cadena',n:'Pulsera Cadena Gruesa',c:'joyeria',a:'Unisex',p:59,d:10,b:'lumen',i:'1602173574767-37ac01994b2a',co:['Dorado'],z:ONE,cl:['urbano'],de:'Eslabones gruesos con baño dorado.'},
    {s:'anillo-solitario',n:'Anillo Brillante',c:'joyeria',a:'Mujer',p:79,b:'lumen',i:'1605100804763-247f67b3557e',co:['Plateado'],z:['6','7','8'],cl:['noche'],de:'Anillo con circonia central y detalles laterales.'},
    // Cinturones y billeteras
    {s:'cinturon-clasico',n:'Cinturón de Cuero',c:'cinturones',a:'Unisex',p:69,b:'andes-leather',i:'1624222247344-550fb60583dc',co:['Marrón','Negro'],z:['S','M','L'],cl:['oficina','basicos'],de:'Cuero genuino con hebilla metálica.'},
    {s:'billetera-essential',n:'Billetera Essential',c:'cinturones',a:'Unisex',p:59,d:10,b:'andes-leather',i:'1627123424574-724758594e93',co:['Marrón'],z:ONE,cl:['basicos'],de:'Billetera compacta con espacio para tarjetas y efectivo.'},
    // Perfumes
    {s:'perfume-noir',n:'Perfume Noir Intense',c:'perfumes',a:'Hombre',p:199,b:'maison-msj',i:'1512777576244-b846ac3d816f',co:['Eau de Parfum'],z:ML,cl:['noche'],de:'Notas de cuero, pimienta negra y vetiver.'},
    {s:'perfume-velvet-rose',n:'Perfume Velvet Rose',c:'perfumes',a:'Mujer',p:179,nw:1,b:'maison-msj',i:'1595425970377-c9703cf48b6d',co:['Eau de Parfum'],z:ML,cl:['noche'],de:'Notas florales de rosa con un fondo cálido.'},
    {s:'perfume-citrus-bloom',n:'Perfume Citrus Bloom',c:'perfumes',a:'Unisex',p:159,d:12,b:'maison-msj',i:'1563170351-be82bc888aa4',co:['Eau de Toilette'],z:ML,cl:['verano'],de:'Fragancia fresca de bergamota, limón y neroli.'},
    {s:'perfume-oud-night',n:'Perfume Oud Night',c:'perfumes',a:'Unisex',p:229,nw:1,b:'maison-msj',i:'1615634260167-c8cdede054de',co:['Eau de Parfum'],z:ML,cl:['noche'],de:'Aroma profundo y especiado de oud y ámbar.'},
    {s:'perfume-aqua-fresh',n:'Perfume Aqua Fresh',c:'perfumes',a:'Hombre',p:149,b:'maison-msj',i:'',co:['Eau de Toilette'],z:ML,cl:['verano','deportivo'],de:'Notas marinas limpias para todos los días.'},
    {s:'perfume-amber-musk',n:'Perfume Amber Musk',c:'perfumes',a:'Unisex',p:189,nw:1,b:'maison-msj',i:'1588405748880-12d1d2a59f75',co:['Eau de Parfum'],z:ML,cl:['noche'],de:'Combinación envolvente de ámbar y almizcle.'},
    {s:'perfume-blue-cedar',n:'Perfume Blue Cedar',c:'perfumes',a:'Hombre',p:209,b:'maison-msj',i:'',co:['Eau de Parfum'],z:ML,cl:['oficina'],de:'Maderas de cedro, lavanda y notas aromáticas.'},
    {s:'perfume-red-diamond',n:'Perfume Red Diamond',c:'perfumes',a:'Mujer',p:219,nw:1,b:'maison-msj',i:'1608528577891-eb055944f2e7',co:['Eau de Parfum'],z:ML,cl:['noche'],de:'Frutos rojos, peonía y vainilla.'},
    {s:'perfume-golden-amber',n:'Perfume Golden Hour',c:'perfumes',a:'Mujer',p:199,d:15,b:'maison-msj',i:'1622618991746-fe6004db3a47',co:['Eau de Parfum'],z:ML,cl:['noche'],de:'Notas solares de flor de azahar y miel.'},
    {s:'perfume-vainilla-coco',n:'Perfume Vainilla Coco',c:'perfumes',a:'Mujer',p:169,b:'maison-msj',i:'',co:['Eau de Toilette'],z:ML,cl:['verano'],de:'Dulce y tropical: vainilla, coco y sándalo.'},
    {s:'perfume-sport-energy',n:'Perfume Sport Energy',c:'perfumes',a:'Hombre',p:159,b:'maison-msj',i:'',co:['Eau de Toilette'],z:ML,cl:['deportivo'],de:'Cítricos energizantes con menta y jengibre.'},
    {s:'perfume-jasmin-blanc',n:'Perfume Jasmin Blanc',c:'perfumes',a:'Mujer',p:189,nw:1,b:'maison-msj',i:'',co:['Eau de Parfum'],z:ML,cl:['oficina'],de:'Jazmín blanco, té verde y almizcle limpio.'},
    {s:'perfume-tabaco-vainilla',n:'Perfume Tabaco & Vainilla',c:'perfumes',a:'Hombre',p:239,b:'maison-msj',i:'',co:['Eau de Parfum'],z:ML,cl:['noche','frio'],de:'Hoja de tabaco, cacao y vainilla tostada.'},
    {s:'perfume-lima-lima',n:'Perfume Lima Garúa',c:'perfumes',a:'Unisex',p:179,nw:1,b:'maison-msj',i:'',co:['Eau de Parfum'],z:ML,cl:['basicos'],de:'Inspirado en Lima: notas húmedas, lima y madera.'},
    {s:'perfume-iris-poudre',n:'Perfume Iris Poudré',c:'perfumes',a:'Mujer',p:249,nw:1,b:'maison-msj',i:'',co:['Extrait de Parfum'],z:ML,cl:['noche'],de:'Notas de salida de pera; corazón de iris y violeta; fondo de almizcle blanco.'},
    {s:'perfume-cuir-noble',n:'Perfume Cuir Noble',c:'perfumes',a:'Hombre',p:259,d:15,b:'maison-msj',i:'',co:['Extrait de Parfum'],z:ML,cl:['noche','frio'],de:'Notas de salida de azafrán; corazón de cuero y rosa oscura; fondo de oud y pachulí.'},
    // Ampliación Mujer
    {s:'pantalon-palazzo-blanco',n:'Pantalón Palazzo Blanco',c:'pantalones',a:'Mujer',p:159,nw:1,b:'atelier-msj',i:'1566206091558-7f218b696731',co:['Blanco','Negro'],z:W,cl:['verano','oficina'],de:'Pierna amplia y fluida en crepé con pretina alta.'},
    {s:'blazer-sastrero-crema',n:'Blazer Sastrero Crema',c:'blazers',a:'Mujer',p:329,nw:1,b:'atelier-msj',i:'1571513722275-4b41940f54b8',co:['Crema','Negro'],z:W,cl:['oficina','noche'],de:'Corte sastre entallado, solapa de muesca y forro satinado.'},
    {s:'blusa-seda-blanca',n:'Blusa de Seda Blanca',c:'blusas',a:'Mujer',p:189,b:'atelier-msj',i:'1581338834647-b0fb40704e21',co:['Blanco','Champagne'],z:W,cl:['oficina'],de:'Seda con caída suave, cuello camisero y puños con botón.'},
    {s:'blusa-lazo-marfil',n:'Blusa con Lazo Marfil',c:'blusas',a:'Mujer',p:139,d:15,b:'atelier-msj',i:'1608234807905-4466023792f5',co:['Marfil'],z:W,cl:['oficina'],de:'Lazo al cuello y mangas amplias de inspiración retro.'},
    {s:'blusa-cruzada-azul',n:'Blusa Cruzada Azul Noche',c:'blusas',a:'Mujer',p:119,b:'atelier-msj',i:'1562572159-4efc207f5aff',co:['Azul noche'],z:W,cl:['noche'],de:'Escote cruzado y lazo lateral para marcar la cintura.'},
    {s:'vestido-midi-lunares',n:'Vestido Midi Lunares',c:'vestidos',a:'Mujer',p:169,nw:1,b:'atelier-msj',i:'1502716119720-b23a93e5fe1b',co:['Rojo lunares'],z:W,cl:['verano'],de:'Lunares clásicos, escote en V y falda con movimiento.'},
    {s:'vestido-midi-gris',n:'Vestido Midi Gris Perla',c:'vestidos',a:'Mujer',p:179,b:'atelier-msj',i:'1617922001439-4a2e6562f328',co:['Gris perla'],z:W,cl:['oficina','verano'],de:'Punto liso de calce recto y largo midi.'},
    {s:'vestido-gala-noir',n:'Vestido de Gala Noir',c:'vestidos',a:'Mujer',p:389,nw:1,b:'atelier-msj',i:'',co:['Negro'],z:W,cl:['noche'],de:'Largo de gala en crepé con espalda descubierta.'},
    {s:'trench-crema',n:'Trench Crema',c:'abrigos',a:'Mujer',p:339,nw:1,b:'atelier-msj',i:'1617019114583-affb34d1b3cd',co:['Crema','Camel'],z:W,cl:['frio','oficina'],de:'Gabardina repelente al agua con cinturón y charreteras.'},
    {s:'casaca-puffer-amarilla',n:'Casaca Puffer Amarilla',c:'casacas',a:'Mujer',p:239,d:20,b:'msj-active',i:'1548624313-0396c75e4b1a',co:['Amarillo','Negro'],z:W,cl:['frio','urbano'],de:'Acolchado voluminoso y cuello alto para el frío.'},
    {s:'jean-skinny-mujer',n:'Jean Skinny Celeste',c:'jeans',a:'Mujer',p:129,b:'msj-urban',i:'1584370848010-d7fe6bc767ec',co:['Celeste'],z:JW,cl:['basicos'],de:'Tiro alto y denim elástico que estiliza.'},
    {s:'enterizo-verde',n:'Enterizo Verde Oliva',c:'conjuntos',a:'Mujer',p:139,nw:1,b:'atelier-msj',i:'1618932260643-eee4a2f652a6',co:['Verde oliva'],z:W,cl:['verano'],de:'Enterizo corto con cinturón y tirantes finos.'},
    {s:'polera-vestido-roja',n:'Polera Vestido Roja',c:'poleras',a:'Mujer',p:119,b:'msj-urban',i:'1485230895905-ec40ba36b9bc',co:['Rojo'],z:W,cl:['urbano'],de:'Polera larga oversize que se usa como vestido.'},
    // Ampliación Hombre
    {s:'casaca-cuero-cafe',n:'Casaca de Cuero Café',c:'casacas',a:'Hombre',p:369,nw:1,b:'andes-leather',i:'1520367745676-56196632073f',co:['Café'],z:M,cl:['noche','frio'],de:'Cuero con acabado envejecido y cierre frontal.'},
    {s:'casaca-gamuza',n:'Casaca de Gamuza',c:'casacas',a:'Hombre',p:339,b:'andes-leather',i:'1617114919297-3c8ddb01f599',co:['Coñac'],z:M,cl:['frio','minimal-luxury'],de:'Gamuza suave estilo trucker con bolsillos al pecho.'},
    {s:'camisa-oscura-slim',n:'Camisa Oscura Slim',c:'camisas',a:'Hombre',p:109,b:'msj-essentials',i:'1563389234808-52344934935c',co:['Azul noche'],z:M,cl:['noche'],de:'Microestampado y corte slim para salir de noche.'},
    {s:'camisa-estampada-resort',n:'Camisa Estampada Resort',c:'camisas',a:'Hombre',p:99,d:10,b:'msj-urban',i:'1612423284934-2850a4ea6b0f',co:['Estampado'],z:M,cl:['verano'],de:'Viscosa fresca de manga corta con estampado tropical.'},
    {s:'polo-back-print',n:'Polo Back Print',c:'polos',a:'Hombre',p:59,nw:1,b:'msj-urban',i:'1564859228273-274232fdb516',co:['Blanco'],z:M,cl:['urbano'],de:'Polo oversize con gráfico en la espalda.'},
    {s:'parka-acolchada',n:'Parka Acolchada',c:'casacas',a:'Unisex',p:279,b:'msj-active',i:'1604644401890-0bd678c83788',co:['Rojo','Azul'],z:U,cl:['frio'],de:'Parka con capucha, relleno térmico y puños interiores.'},
    {s:'mocasines-cuero',n:'Mocasines de Cuero',c:'zapatos',a:'Hombre',p:249,nw:1,b:'andes-leather',i:'',co:['Coñac','Negro'],z:SM,cl:['oficina','minimal-luxury'],de:'Mocasín penny de cuero con suela flexible.'},
    // Ampliación Calzado
    {s:'botines-tacon-negros',n:'Botines de Tacón Negros',c:'botas',a:'Mujer',p:269,nw:1,b:'andes-leather',i:'1582897085656-c636d006a246',co:['Negro'],z:SW,cl:['frio','noche'],de:'Botín de cuero con tacón ancho de 7 cm.'},
    {s:'zapatillas-multicolor',n:'Zapatillas Multicolor',c:'zapatillas',a:'Unisex',p:219,d:15,b:'msj-active',i:'1560769629-975ec94e6a86',co:['Multicolor'],z:SU,cl:['urbano'],de:'Suela gruesa y paneles de colores en malla técnica.'},
    {s:'zapatillas-trail',n:'Zapatillas Trail',c:'zapatillas',a:'Unisex',p:279,nw:1,b:'msj-active',i:'1595341888016-a392ef81b7de',co:['Gris y naranja'],z:SU,cl:['deportivo'],de:'Agarre para terreno irregular y amortiguación reactiva.'},
    // Ampliación Accesorios
    {s:'bolso-croco-marron',n:'Bolso Croco Marrón',c:'bolsos',a:'Mujer',p:229,nw:1,b:'andes-leather',i:'1594633313593-bab3825d0caf',co:['Marrón'],z:ONE,cl:['minimal-luxury'],de:'Cuero grabado efecto croco con correa ajustable.'},
    {s:'cartera-estructurada-conac',n:'Cartera Estructurada Coñac',c:'bolsos',a:'Mujer',p:199,b:'andes-leather',i:'1600857062241-98e5dba7f214',co:['Coñac'],z:ONE,cl:['minimal-luxury','oficina'],de:'Silueta estructurada, solapa magnética y cuero liso.'},
    {s:'reloj-sport-cronografo',n:'Reloj Sport Cronógrafo',c:'relojes',a:'Hombre',p:299,d:10,b:'lumen',i:'1539874754764-5a96559165b0',co:['Plateado'],z:ONE,cl:['deportivo'],de:'Bisel graduado, cronógrafo y correa de cuero.'},
    {s:'collar-esmeralda',n:'Collar Esmeralda Bañado en Oro',c:'joyeria',a:'Mujer',p:119,nw:1,b:'lumen',i:'1599643477877-530eb83abc8e',co:['Dorado'],z:ONE,cl:['noche','minimal-luxury'],de:'Dije facetado verde esmeralda en cadena bañada en oro de 18 k.'},
    {s:'pulsera-oro-rosa',n:'Pulsera Oro Rosa',c:'joyeria',a:'Mujer',p:89,b:'lumen',i:'1611591437281-460bfbe1220a',co:['Oro rosa'],z:ONE,cl:['noche'],de:'Eslabones entrelazados con circonias, baño en oro rosa.'},
    {s:'aretes-argolla-dorados',n:'Aretes Argolla Bañados en Oro',c:'joyeria',a:'Mujer',p:79,nw:1,b:'lumen',i:'1617038220319-276d3cfab638',co:['Dorado'],z:ONE,cl:['minimal-luxury'],de:'Argollas gruesas con baño en oro de 18 k.'},
    {s:'aretes-corazon-azul',n:'Aretes Corazón Azul',c:'joyeria',a:'Mujer',p:55,d:10,b:'lumen',i:'1630019852942-f89202989a59',co:['Dorado y azul'],z:ONE,cl:['verano'],de:'Cristales en forma de corazón sobre gancho dorado.'},
    // Catálogo secreto MSJ Privilège (vip:1): solo socios lo ven y lo compran; el servidor lo exige en RLS y checkout_cart.
    {s:'perfume-sovereign-oud-privee',n:'Sovereign Oud · Édition Privée',c:'perfumes',a:'Unisex',p:349,nw:1,vip:1,b:'maison-msj',i:'1615634260167-c8cdede054de',co:['Extrait de Parfum'],z:ML,cl:['noche'],de:'Edición numerada. Salida de azafrán y pimienta rosa; corazón de oud y rosa de Taif; fondo de ámbar gris y cuero.'},
    {s:'perfume-rose-imperiale-early',n:'Rose Impériale · Early Access',c:'perfumes',a:'Mujer',p:299,nw:1,vip:1,b:'maison-msj',i:'1595425970377-c9703cf48b6d',co:['Eau de Parfum'],z:ML,cl:['noche'],de:'Lanzamiento anticipado para socios. Rosa centifolia, lichi y peonía sobre almizcle blanco y vainilla.'},
    {s:'casaca-obsidian-cuero-privee',n:'Casaca Obsidian de Cuero · Edición Limitada',c:'casacas',a:'Hombre',p:589,nw:1,vip:1,b:'andes-leather',i:'1520975954732-35dd22299614',co:['Negro obsidiana'],z:M,cl:['noche','urbano'],de:'Cuero de napa con herrajes en tono champán y forro de satén. Serie limitada a 50 piezas.'},
    {s:'terno-principe-gales-privee',n:'Terno Príncipe de Gales · Privée',c:'blazers',a:'Hombre',p:689,vip:1,b:'atelier-msj',i:'1594938298603-c8148c4dae35',co:['Azul cuadros'],z:M,cl:['oficina'],de:'Lana fría con forro en seda y botones de cuerno. Confección a medida disponible.'},
    {s:'vestido-amatista-privee',n:'Vestido Satín Amatista · Privée',c:'vestidos',a:'Mujer',p:459,nw:1,vip:1,b:'atelier-msj',i:'1566174053879-31528523f8ae',co:['Amatista'],z:W,cl:['noche'],de:'Satín de seda con escote drapeado y espalda baja. Edición para la temporada de gala.'},
    {s:'cartera-croco-cognac-privee',n:'Cartera Croco Cognac · Privée',c:'bolsos',a:'Mujer',p:429,vip:1,b:'andes-leather',i:'1594633313593-bab3825d0caf',co:['Cognac'],z:ONE,cl:['minimal-luxury'],de:'Cuero grabado croco con cierre bañado en oro y cadena desmontable.'},
    {s:'reloj-noir-automatico-privee',n:'Reloj Noir Automático · Privée',c:'relojes',a:'Hombre',p:549,vip:1,b:'lumen',i:'1434056886845-dac89ffe9b56',co:['Negro y dorado'],z:ONE,cl:['oficina','noche'],de:'Movimiento automático visible, cristal de zafiro y correa de cuero italiano.'},
    {s:'collar-esmeralda-haute-privee',n:'Collar Esmeralda Haute Joaillerie',c:'joyeria',a:'Mujer',p:389,vip:1,b:'lumen',i:'1599643477877-530eb83abc8e',co:['Oro 18 k'],z:ONE,cl:['noche','minimal-luxury'],de:'Plata 925 con baño grueso en oro de 18 k y piedra verde facetada. Estuche de regalo numerado.'}
  ];
  // Colecciones cápsula: se derivan de las colecciones de temporada para no repetir etiquetas en cada producto.
  const minimalLuxury = ['camisa-blanca-formal','blusa-saten','abrigo-pano','abrigo-negro-largo','blazer-azul-slim','zapatos-derby-marron','reloj-clasico-blanco','reloj-negro-minimal','cinturon-clasico','mochila-cuero','zapatillas-beige-minimal','collar-perlas','perfume-jasmin-blanc','pantalon-palazzo-blanco','blazer-sastrero-crema','blusa-seda-blanca','trench-crema'];
  products.forEach(product => {
    const tags = new Set(product.cl || []);
    if (tags.has('frio')) tags.add('otono-invierno');
    if (tags.has('noche')) tags.add('night-edition');
    if (minimalLuxury.includes(product.s)) tags.add('minimal-luxury');
    product.cl = [...tags];
  });
  products.find(product => product.s === 'casaca-cortavientos').i = '1601924994987-69e26d50dc26';
  products.find(product => product.s === 'blazer-mujer-oversize').i = '1600091166971-7f9faad6c1e2';
  const imageUrl = (id, width = 900) => id ? `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80` : '';
  return {departments, categories, brands, collections, products, imageUrl, perfumeLargeFactor: 1.45};
})();
