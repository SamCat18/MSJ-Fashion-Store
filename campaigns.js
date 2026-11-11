// Campañas de MSJ: promociones por feriados peruanos (2x1 o %), modo Blanco y Negro y franja de anuncios.
// El calendario de respaldo debe coincidir con la tabla public.promotions de database/campaigns.sql: el descuento real lo calcula
// checkout_cart en el servidor; aquí solo se muestra al cliente antes de pagar.
window.MSJCampaigns = (() => {
  const calendar = [
    {code:'SEMANA-CRIOLLA',name:'Semana Criolla 2x1',tagline:'Día de la Canción Criolla y Todos los Santos: lleva 2 y paga 1 en polos, poleras, camisas, blusas y gorras.',kind:'2x1',discount_value:0,category_slugs:['polos','poleras','camisas','blusas','gorras'],theme:null,starts_at:'2026-10-28T00:00:00-05:00',ends_at:'2026-11-02T00:00:00-05:00'},
    {code:'BLACK-FRIDAY',name:'Black & White Friday',tagline:'La tienda se viste de blanco y negro: 2x1 en polos, jeans, joggers y zapatillas.',kind:'2x1',discount_value:0,category_slugs:['polos','poleras','jeans','pantalones','joggers','zapatillas'],theme:'bw',starts_at:'2026-11-27T00:00:00-05:00',ends_at:'2026-12-01T00:00:00-05:00'},
    {code:'NAVIDAD',name:'Navidad MSJ 2x1',tagline:'Regalos para dos al precio de uno: perfumes, relojes, lentes y joyería.',kind:'2x1',discount_value:0,category_slugs:['perfumes','relojes','lentes','joyeria'],theme:null,starts_at:'2026-12-18T00:00:00-05:00',ends_at:'2026-12-25T00:00:00-05:00'},
    {code:'DIA-MADRE',name:'Día de la Madre',tagline:'20% en vestidos, blusas, bolsos y perfumes.',kind:'percent',discount_value:20,category_slugs:['vestidos','blusas','bolsos','perfumes'],theme:null,starts_at:'2027-05-03T00:00:00-05:00',ends_at:'2027-05-10T00:00:00-05:00'},
    {code:'FIESTAS-PATRIAS',name:'Fiestas Patrias',tagline:'28% por el 28 de julio en toda la tienda.',kind:'percent',discount_value:28,category_slugs:null,theme:null,starts_at:'2027-07-25T00:00:00-05:00',ends_at:'2027-07-30T00:00:00-05:00'}
  ];
  const themeKey = 'msj-theme';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const money = value => new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(value||0));
  // ?promo=BLACK-FRIDAY permite mostrar al jurado cualquier campaña del calendario sin esperar la fecha (solo visual; el servidor manda).
  const preview = new URLSearchParams(location.search).get('promo');
  let active = calendar.find(promo => promo.code === String(preview||'').toUpperCase()) || current(calendar);
  let timer = 0;

  function current(list){const now=Date.now();return list.find(promo=>now>=Date.parse(promo.starts_at)&&now<Date.parse(promo.ends_at))||null}
  function upcoming(){const now=Date.now();return calendar.filter(promo=>Date.parse(promo.starts_at)>now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))[0]||null}
  function eligible(product,promo=active){return Boolean(promo&&(!promo.category_slugs||promo.category_slugs.includes(product?.category_slug||product?.category)))}
  // Igual que checkout_cart: unidades participantes de mayor a menor; en 2x1 sale gratis la segunda de cada par.
  function discount(lines,promo=active){if(!promo)return {amount:0,promo:null,units:0};const units=[];lines.forEach(line=>{if(eligible(line,promo))for(let i=0;i<line.quantity;i++)units.push(Number(line.price))});units.sort((a,b)=>b-a);const raw=promo.kind==='2x1'?units.filter((_,index)=>index%2===1).reduce((sum,value)=>sum+value,0):units.reduce((sum,value)=>sum+value,0)*Number(promo.discount_value)/100;return {amount:Math.round((raw+Number.EPSILON)*100)/100,promo,units:units.length}}
  function badge(product){if(!eligible(product))return'';return `<span class="promo-flag">${active.kind==='2x1'?'2x1':`-${Number(active.discount_value)}%`}</span>`}
  function countdown(target){const ms=Math.max(0,Date.parse(target)-Date.now());const days=Math.floor(ms/864e5),hours=Math.floor(ms%864e5/36e5),minutes=Math.floor(ms%36e5/6e4),seconds=Math.floor(ms%6e4/1e3);return days?`${days}d ${hours}h ${minutes}m`:`${hours}h ${minutes}m ${String(seconds).padStart(2,'0')}s`}

  function storedTheme(){try{return localStorage.getItem(themeKey)}catch{return null}}
  // Tres temas: claro (colores MSJ), oscuro (negro cálido con dorado, descansa la vista) y blanco y negro.
  const themes={color:['☀','Claro'],dark:['☾','Oscuro'],bw:['◐','B/N']};const order=['color','dark','bw'];
  // Lo que el cliente elige manda siempre; sin elección, la campaña activa puede proponer B/N (Black & White Friday).
  function currentTheme(){const choice=storedTheme();return themes[choice]?choice:active?.theme==='bw'?'bw':'color'}
  function applyTheme(){const mode=currentTheme();document.documentElement.classList.toggle('msj-bw',mode==='bw');document.documentElement.classList.toggle('msj-dark',mode==='dark');const button=document.getElementById('theme-toggle');if(button){button.innerHTML=`<span aria-hidden="true">${themes[mode][0]}</span><span class="theme-label">${themes[mode][1]}</span>`;button.setAttribute('aria-label',`Tema: ${themes[mode][1]}. Elegir tema`);button.title='Elegir tema'}document.querySelectorAll('[data-theme-option]').forEach(option=>option.setAttribute('aria-checked',String(option.dataset.themeOption===mode)))}
  // El cambio se anima solo cuando el cliente elige; al cargar cada página el tema se aplica sin destello.
  function setTheme(mode){try{localStorage.setItem(themeKey,mode)}catch{}const root=document.documentElement;root.classList.add('theme-switching');applyTheme();setTimeout(()=>root.classList.remove('theme-switching'),450)}
  function themeMenu(open){const button=document.getElementById('theme-toggle'),menu=document.getElementById('theme-menu');if(!button||!menu)return;menu.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)menu.querySelector('[aria-checked="true"]')?.focus()}

  function renderAnnouncement(){const bar=document.querySelector('.announcement');if(!bar)return;clearInterval(timer);const next=upcoming();const cause=window.STORE_CONFIG?.donation;const causeText=cause?` <span>•</span> 1% DE CADA COMPRA PARA LAS ${escape(cause.cause).toUpperCase()}`:'';if(active){const paint=()=>{bar.innerHTML=`<strong>✦ ${escape(active.name).toUpperCase()}</strong> <span>•</span> ${active.kind==='2x1'?'LLEVA 2, PAGA 1':`${Number(active.discount_value)}% DE DESCUENTO`} <span>•</span> TERMINA EN <strong class="promo-clock">${countdown(active.ends_at)}</strong>${causeText}`};paint();timer=setInterval(paint,1000);bar.classList.add('promo-live');return}bar.classList.remove('promo-live');if(next)bar.innerHTML=`ENVÍOS A TODO EL PERÚ <span>•</span> PRÓXIMA CAMPAÑA: <strong>${escape(next.name).toUpperCase()}</strong> EN ${countdown(next.starts_at)}${causeText}`}

  function setActive(promo){if(preview)return;active=promo&&promo.code?promo:null;applyTheme();renderAnnouncement();document.dispatchEvent(new CustomEvent('msj:promo'))}

  // Selector de tema en la cabecera de todas las páginas: abre un menú, así un clic accidental no cambia los colores.
  const actions=document.querySelector('.top-actions');
  if(actions&&!document.getElementById('theme-toggle'))actions.insertAdjacentHTML('afterbegin',`<div class="theme-picker"><button class="icon-button theme-toggle" id="theme-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="theme-menu"><span aria-hidden="true">☀</span><span class="theme-label">Claro</span></button><div class="theme-menu" id="theme-menu" role="menu" aria-label="Tema de la tienda" hidden>${order.map(mode=>`<button role="menuitemradio" aria-checked="false" data-theme-option="${mode}"><span aria-hidden="true">${themes[mode][0]}</span>${themes[mode][1]}</button>`).join('')}</div></div>`);
  document.getElementById('theme-toggle')?.addEventListener('click',()=>themeMenu(document.getElementById('theme-menu').hidden));
  document.getElementById('theme-menu')?.addEventListener('click',event=>{const option=event.target.closest('[data-theme-option]');if(!option)return;setTheme(option.dataset.themeOption);themeMenu(false);document.getElementById('theme-toggle').focus()});
  document.addEventListener('click',event=>{if(!event.target.closest('.theme-picker'))themeMenu(false)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.getElementById('theme-menu')?.hidden){themeMenu(false);document.getElementById('theme-toggle').focus()}});
  // Si el tema cambia en otra pestaña, esta se actualiza también.
  addEventListener('storage',event=>{if(event.key===themeKey)applyTheme()});
  applyTheme();renderAnnouncement();

  return {get active(){return active},calendar,upcoming,eligible,discount,badge,setActive,countdown,money};
})();

// Mapa de seguimiento: silueta simplificada del Perú (lon/lat aproximados) con la ruta desde el almacén de Lima hasta la ciudad del pedido.
window.MSJPeruMap = (() => {
  const border = [[-80.3,-3.4],[-79.6,-4.4],[-79.0,-5.0],[-78.4,-3.6],[-77.0,-2.6],[-75.6,-1.5],[-75.2,-0.1],[-74.0,-1.0],[-72.4,-2.4],[-70.6,-2.3],[-70.0,-4.2],[-71.5,-6.0],[-73.1,-7.3],[-73.9,-7.6],[-72.8,-9.0],[-70.6,-9.5],[-69.6,-10.95],[-68.7,-12.5],[-69.3,-14.5],[-69.0,-15.3],[-69.5,-15.8],[-69.0,-16.5],[-69.5,-17.5],[-70.4,-18.35],[-71.3,-17.6],[-72.0,-17.0],[-73.5,-16.2],[-75.2,-15.2],[-76.2,-13.7],[-77.1,-12.0],[-77.7,-11.0],[-78.6,-9.1],[-79.0,-8.1],[-79.9,-6.8],[-81.1,-5.8],[-81.3,-4.6]];
  const cities = {lima:['Lima',-77.04,-12.05],callao:['Callao',-77.13,-12.05],arequipa:['Arequipa',-71.54,-16.4],trujillo:['Trujillo',-79.03,-8.11],chiclayo:['Chiclayo',-79.84,-6.77],piura:['Piura',-80.63,-5.19],tumbes:['Tumbes',-80.45,-3.57],cusco:['Cusco',-71.97,-13.53],iquitos:['Iquitos',-73.25,-3.75],huancayo:['Huancayo',-75.21,-12.07],puno:['Puno',-70.02,-15.84],juliaca:['Juliaca',-70.13,-15.5],tacna:['Tacna',-70.25,-18.01],ica:['Ica',-75.73,-14.07],pucallpa:['Pucallpa',-74.55,-8.38],ayacucho:['Ayacucho',-74.22,-13.16],cajamarca:['Cajamarca',-78.5,-7.16],huaraz:['Huaraz',-77.53,-9.53],chimbote:['Chimbote',-78.58,-9.07],tarapoto:['Tarapoto',-76.36,-6.48],'puerto maldonado':['Puerto Maldonado',-69.19,-12.59],moquegua:['Moquegua',-70.94,-17.19],huanuco:['Huánuco',-76.24,-9.93],chachapoyas:['Chachapoyas',-77.87,-6.23],abancay:['Abancay',-72.88,-13.64],huancavelica:['Huancavelica',-74.98,-12.79],'cerro de pasco':['Cerro de Pasco',-76.26,-10.68]};
  const k = 26, pad = 14, x = lon => pad + (lon + 81.5) * k, y = lat => pad + (-lat - 0) * k;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const plain = text => String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  // Busca la ciudad del pedido en el texto (ciudad, distrito o zona); si no la reconoce, el destino es Lima.
  function city(text){const value=plain(text);const key=Object.keys(cities).sort((a,b)=>b.length-a.length).find(name=>value.includes(name));const [name,lon,lat]=cities[key||'lima'];return {key:key||'lima',name,lon,lat,known:Boolean(key)}}
  function km(a,b){const rad=Math.PI/180;const h=Math.sin((b.lat-a.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;return Math.round(12742*Math.asin(Math.sqrt(h))*1.25)}
  function addBusinessDays(date,days){const result=new Date(date);let left=days;while(left>0){result.setDate(result.getDate()+1);const day=result.getDay();if(day!==0&&day!==6)left--}return result}
  // Plazo: el de la zona de envío si existe; si no, se estima por distancia por carretera (~600 km al día).
  function eta(destination,zone,from=new Date()){const distance=km({lon:cities.lima[1],lat:cities.lima[2]},destination);const min=zone?Number(zone.days_min):destination.key==='lima'||destination.key==='callao'?1:Math.ceil(distance/600)+1;const max=zone?Number(zone.days_max):min+2;return {distance,min,max,date:addBusinessDays(from,max)}}
  const stages = {pending:.06,paid:.2,confirmed:.35,shipped:.68,delivered:1};
  function svg(destination,stage='pending'){const lima={lon:cities.lima[1],lat:cities.lima[2]};const [x1,y1,x2,y2]=[x(lima.lon),y(lima.lat),x(destination.lon),y(destination.lat)];const same=destination.key==='lima'||destination.key==='callao';const cx=(x1+x2)/2+(y2-y1)*.25,cy=(y1+y2)/2-(x2-x1)*.25-18;const t=stages[stage]??.06;const px=(1-t)**2*x1+2*(1-t)*t*cx+t*t*x2,py=(1-t)**2*y1+2*(1-t)*t*cy+t*t*y2;const width=Math.round(13.3*k+pad*2),height=Math.round(18.6*k+pad*2);const dots=Object.values(cities).map(([,lon,lat])=>`<circle cx="${x(lon).toFixed(1)}" cy="${y(lat).toFixed(1)}" r="2.2" class="map-city"/>`).join('');return `<svg class="peru-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ruta de envío de Lima a ${escape(destination.name)}"><path class="map-land" d="M${border.map(([lon,lat])=>`${x(lon).toFixed(1)},${y(lat).toFixed(1)}`).join('L')}Z"/>${dots}${same?'':`<path class="map-route-base" d="M${x1},${y1} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2},${y2}"/><path class="map-route" d="M${x1},${y1} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2},${y2}"/>`}<circle cx="${x1}" cy="${y1}" r="6" class="map-origin"/><text x="${x1-10}" y="${y1+4}" text-anchor="end" class="map-label">Almacén Lima</text>${same?'':`<circle cx="${x2}" cy="${y2}" r="11" class="map-pulse"/><circle cx="${x2}" cy="${y2}" r="6" class="map-dest"/><text x="${x2+(x2>width-90?-10:10)}" y="${y2+4}" text-anchor="${x2>width-90?'end':'start'}" class="map-label strong">${escape(destination.name)}</text>`}<g class="map-truck" transform="translate(${px.toFixed(1)},${py.toFixed(1)})"><circle r="11"/><text y="4.5" text-anchor="middle">🚚</text></g></svg>`}
  return {city,eta,svg,km};
})();
