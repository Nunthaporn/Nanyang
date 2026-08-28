import{a as e,n as t,t as n}from"./index-BuLOFvRd.js";import{t as r}from"./esm-BhAIS2xI.js";var i=(...e)=>e.filter((e,t,n)=>!!e&&e.trim()!==``&&n.indexOf(e)===t).join(` `).trim(),a=e=>e.replace(/([a-z0-9])([A-Z])/g,`$1-$2`).toLowerCase(),o=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,t,n)=>n?n.toUpperCase():t.toLowerCase()),s=e=>{let t=o(e);return t.charAt(0).toUpperCase()+t.slice(1)},c={xmlns:`http://www.w3.org/2000/svg`,width:24,height:24,viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:2,strokeLinecap:`round`,strokeLinejoin:`round`},l=e=>{for(let t in e)if(t.startsWith(`aria-`)||t===`role`||t===`title`)return!0;return!1},u=e(t(),1),d=(0,u.createContext)({}),f=()=>(0,u.useContext)(d),p=(0,u.forwardRef)(({color:e,size:t,strokeWidth:n,absoluteStrokeWidth:r,className:a=``,children:o,iconNode:s,...d},p)=>{let{size:m=24,strokeWidth:h=2,absoluteStrokeWidth:g=!1,color:_=`currentColor`,className:v=``}=f()??{},y=r??g?Number(n??h)*24/Number(t??m):n??h;return(0,u.createElement)(`svg`,{ref:p,...c,width:t??m??c.width,height:t??m??c.height,stroke:e??_,strokeWidth:y,className:i(`lucide`,v,a),...!o&&!l(d)&&{"aria-hidden":`true`},...d},[...s.map(([e,t])=>(0,u.createElement)(e,t)),...Array.isArray(o)?o:[o]])}),m=(e,t)=>{let n=(0,u.forwardRef)(({className:n,...r},o)=>(0,u.createElement)(p,{ref:o,iconNode:t,className:i(`lucide-${a(s(e))}`,`lucide-${e}`,n),...r}));return n.displayName=s(e),n},h=m(`chart-column`,[[`path`,{d:`M3 3v16a2 2 0 0 0 2 2h16`,key:`c24i48`}],[`path`,{d:`M18 17V9`,key:`2bz60n`}],[`path`,{d:`M13 17V5`,key:`1frdt8`}],[`path`,{d:`M8 17v-3`,key:`17ska0`}]]),g=m(`refresh-ccw`,[[`path`,{d:`M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`14sxne`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}],[`path`,{d:`M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16`,key:`1hlbsb`}],[`path`,{d:`M16 16h5v5`,key:`ccwih5`}]]),_=(e,t={})=>{let n=new URLSearchParams({start_date:e.start_date,end_date:e.end_date,customer_type:e.customer_type,...t});return e.factory.forEach(e=>n.append(`factory`,e)),e.customer&&n.set(`customer`,e.customer),n};async function v(e,t,n,r={}){let i=await fetch(`${e}?${_(t,r)}`,{signal:n});if(!i.ok)throw Error(i.status===503?`ไม่สามารถเชื่อมต่อฐานข้อมูลได้`:`API error ${i.status}`);return i.json()}var y={G1:`#f04486`,G2:`#ffd126`,G3:`#ff7917`,G4:`#15b7c6`,TRM:`#2889dc`,EA:`#54df0b`},b=e=>e==null?`N/A`:`${(e*100).toFixed(1)}%`,x=(e,t)=>!t||e?1:.2,S=[`#1812a8`,`#ffd91a`,`#ff8b2c`,`#16b9c7`,`#2c8ce5`,`#5bdc20`,`#ef4b87`,`#8a63d2`,`#00a67d`,`#d6692f`],C=e=>{let t=0;for(let n=0;n<e.length;n++)t=(t<<5)-t+e.charCodeAt(n)|0;return S[Math.abs(t)%S.length]},w=e=>e.replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),T=e=>`${Math.min(90,Math.max(12,18+e*74))}%`,E=(e,t)=>({color:[`#20b4d4`,`#2e5db2`],legend:{show:!1},tooltip:{trigger:`axis`,confine:!0,axisPointer:{type:`line`,lineStyle:{type:`dashed`}},formatter:e=>{let t=Array.isArray(e)?e:[e],n=t[0]?.axisValueLabel??t[0]?.name??``,r=t.find(e=>e.seriesName===`VVIC`),i=t.find(e=>e.seriesName===`NON-VVIC`);return`
        <div style="
          min-width:150px;
          padding:4px 2px;
          font-family:Inter, Segoe UI, sans-serif;
        ">

          <div style="
            font-weight:700;
            margin-bottom:10px;
            color:#273142;
          ">
            ${n}
          </div>

          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:20px;
            margin-bottom:8px;
          ">
            <div style="
              display:flex;
              align-items:center;
              gap:7px;
            ">
              <span style="
                width:10px;
                height:10px;
                border-radius:50%;
                background:#20b4d4;
                display:inline-block;
              "></span>

              <span>VVIC</span>
            </div>

            <b>${r?.value==null?`N/A`:b(Number(r.value))}</b>
          </div>

          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:20px;
          ">
            <div style="
              display:flex;
              align-items:center;
              gap:7px;
            ">
              <span style="
                width:10px;
                height:10px;
                border-radius:50%;
                background:#2e5db2;
                display:inline-block;
              "></span>

              <span>NON-VVIC</span>
            </div>

            <b>${i?.value==null?`N/A`:b(Number(i.value))}</b>
          </div>

        </div>
      `}},grid:{left:65,right:25,top:35,bottom:82},xAxis:{type:`category`,data:e.map(e=>e.month),axisLabel:{rotate:45}},yAxis:{type:`value`,min:e=>Math.max(0,Math.floor((e.min-.05)*20)/20),max:e=>Math.min(1,Math.ceil((e.max+.05)*20)/20),axisLabel:{formatter:e=>`${Math.round(e*100)}%`},splitLine:{lineStyle:{type:`dashed`,color:`#d9e4f2`}}},dataZoom:[{type:`inside`},{type:`slider`,height:13,bottom:8}],series:[{name:`VVIC`,type:`line`,smooth:!0,connectNulls:!1,symbolSize:10,lineStyle:{opacity:t?.28:1},data:e.map(e=>({value:e.vvic,itemStyle:{opacity:x(e.month===t,!!t)}})),label:{show:!0,formatter:e=>b(e.value),fontWeight:`bold`,color:`#0586a7`}},{name:`NON-VVIC`,type:`line`,smooth:!0,connectNulls:!1,symbolSize:9,lineStyle:{opacity:t?.28:1},data:e.map(e=>({value:e.non_vvic,itemStyle:{opacity:x(e.month===t,!!t)}})),label:{show:!0,formatter:e=>b(e.value),color:`#2e5db2`}}]}),D=(e,t,n)=>{let r=[...new Set(e.map(e=>e.month))].sort(),i=Object.keys(y),a=new Map;r.forEach(t=>e.filter(e=>e.month===t&&e.eff_pct!=null).sort((e,t)=>(e.eff_pct??0)-(t.eff_pct??0)).forEach((e,n)=>a.set(`${t}|${e.factory}`,n)));let o=i.map(t=>({name:t,type:`custom`,coordinateSystem:`cartesian2d`,renderItem:(e,i)=>{let a=r[e.dataIndex],o=i.value(1),s=i.value(2),c=i.value(3),l=i.coord([a,o]),u=i.size([1,0])[0]*.72,d=Math.min(25,Math.abs(i.size([0,1])[1])*.72),f=l[0]-u/2,p=l[1]-d/2,m=!n||a===n.month&&(!n.factory||t===n.factory),h=[];if(c!=null&&e.dataIndex<r.length-1){let a=i.coord([r[e.dataIndex+1],c]),o=f+u,s=a[0]-u/2,p=a[1];h.push({type:`path`,shape:{pathData:`M${o},${l[1]-d/2} C${(o+s)/2},${l[1]-d/2} ${(o+s)/2},${p-d/2} ${s},${p-d/2} L${s},${p+d/2} C${(o+s)/2},${p+d/2} ${(o+s)/2},${l[1]+d/2} ${o},${l[1]+d/2} Z`},style:{fill:y[t],opacity:n?n.factory&&n.factory!==t?.14:.35:.72}})}return h.push({type:`rect`,shape:{x:f,y:p,width:u,height:d,r:2},style:{fill:y[t],opacity:m?1:.2}}),s!=null&&Number.isFinite(Number(s))&&h.push({type:`text`,style:{x:l[0],y:l[1],text:b(Number(s)),fill:`#07162e`,font:`700 11px Inter, Segoe UI, sans-serif`,textAlign:`center`,textVerticalAlign:`middle`,opacity:m?1:.3}}),{type:`group`,children:h}},data:r.map((n,i)=>{let o=e.find(e=>e.month===n&&e.factory===t),s=r[i+1];return{name:n,value:[n,a.get(`${n}|${t}`)??null,o?.eff_pct??null,s?a.get(`${s}|${t}`)??null:null]}}),encode:{x:0,y:1}}));return{color:i.map(e=>y[e]),tooltip:{trigger:`item`,confine:!0,backgroundColor:`#fff`,borderColor:`#aeb8c6`,borderWidth:1,padding:0,extraCssText:`box-shadow:0 8px 24px rgba(20,35,60,.22);border-radius:3px;`,formatter:e=>{let n=String(e?.value?.[0]??e?.name??``),r=String(e?.seriesName??``),i=t.filter(e=>e.month===n&&e.factory===r&&e.eff_pct!=null).sort((e,t)=>(t.eff_pct??0)-(e.eff_pct??0)),a=Math.max(...i.map(e=>e.eff_pct??0),.01),o=i.length?i.map(e=>{let t=Math.max(5,(e.eff_pct??0)/a*205),n=C(e.product_type);return`<div style="margin-top:10px"><div style="font-size:10px;color:#283247;margin-bottom:4px">${w(e.product_type)}</div><div style="display:flex;align-items:center;gap:9px"><span style="display:block;width:${t}px;max-width:205px;height:15px;border-radius:2px;background:${n}"></span><b style="font-size:11px;color:#172033">${b(e.eff_pct)}</b></div></div>`}).join(``):`<div style="margin-top:10px;color:#748196;font-size:11px">No Product Type data</div>`;return`<div style="padding:12px 14px;min-width:270px"><div style="font-size:12px;font-weight:700;color:#263145">EFF% by Product Type</div><div style="font-size:10px;color:#748196;margin-top:3px">${w(r)} · ${w(n)}</div>${o}</div>`}},legend:{top:0,left:0,itemWidth:10,itemHeight:10},grid:{left:25,right:18,top:65,bottom:35},xAxis:{type:`category`,data:r,boundaryGap:!0,axisTick:{show:!1},axisLine:{show:!1}},yAxis:{type:`value`,show:!1,min:-.5,max:5.5,interval:1},series:o}},O=(e,t,n,r)=>({tooltip:{trigger:`item`,confine:!0,backgroundColor:`#fff`,borderColor:`#aeb8c6`,borderWidth:1,padding:0,extraCssText:`box-shadow:0 8px 24px rgba(20,35,60,.22);border-radius:3px;`,formatter:n=>{let r=String(n?.name??``),i=e.find(e=>e.customer===r),a=t.filter(e=>e.customer===r&&e.eff_pct!=null).sort((e,t)=>(t.eff_pct??0)-(e.eff_pct??0)).map(e=>`
            <div
              style="
                display:grid;
                grid-template-columns:60px 150px 48px;
                gap:8px;
                align-items:center;
                margin-top:9px
              "
            >
              <span
                style="
                  font-size:10px;
                  color:#5f6878
                "
              >
                ${w(e.factory)}
              </span>

              <span
                style="
                  height:20px;
                  background:${y[e.factory]??`#48bc67`};
                  border-radius:3px
                "
              ></span>

              <b
                style="
                  font-size:11px;
                  color:#263145;
                  text-align:right
                "
              >
                ${b(e.eff_pct)}
              </b>
            </div>
          `).join(``);return`
        <div
          style="
            padding:12px 14px;
            min-width:300px
          "
        >
          <div
            style="
              font-size:12px;
              font-weight:700;
              color:#263145
            "
          >
            EFF% by FACTORY
          </div>

          <div
            style="
              font-size:10px;
              color:#748196;
              margin-top:3px
            "
          >
            ${w(r)} · ${w(i?.month??``)}
          </div>

          ${a||`
              <div
                style="
                  margin-top:10px;
                  color:#748196;
                  font-size:11px
                "
              >
                No Factory data
              </div>
            `}
        </div>
      `}},grid:{left:175,right:75,top:50,bottom:40},graphic:[{type:`text`,left:T(n),top:24,z:10,style:{text:`Target: ${b(n)}`,fill:`#3561b6`,font:`700 11px Inter, Segoe UI, sans-serif`,textAlign:`center`,textVerticalAlign:`bottom`}}],xAxis:{type:`value`,min:0,max:1,axisLabel:{formatter:e=>`${Math.round(e*100)}%`},splitLine:{lineStyle:{type:`dashed`,color:`#d9e4f2`}},axisLine:{show:!1},axisTick:{show:!1}},yAxis:{type:`category`,inverse:!0,data:e.map(e=>e.customer),axisTick:{show:!1},axisLine:{show:!1},axisLabel:{fontSize:11,margin:12,width:150,overflow:`truncate`}},series:[{type:`bar`,barWidth:20,data:e.map(e=>({name:e.customer,value:e.eff_pct,itemStyle:{color:(e.eff_pct??0)>=n?`#23df7a`:`#df8396`,borderRadius:[0,5,5,0],opacity:x(e.customer===r,!!r)}})),label:{show:!0,position:`right`,formatter:e=>e.value==null?``:b(Number(e.value)),fontWeight:`bold`,fontSize:10,distance:8},markLine:{symbol:`none`,silent:!0,lineStyle:{color:`#7ba4ec`,type:`dashed`,width:2},label:{show:!1},data:[{xAxis:n}]}}]}),k=n(),A=[`G1`,`G2`,`G3`,`G4`,`TRM`,`EA`],j=e=>e==null?`N/A`:`${(e*100).toFixed(2)}%`,M=e=>`${e.slice(0,4)}-01-01`;function N(){let[e,t]=(0,u.useState)({start_date:`2026-01-01`,end_date:`2026-12-31`,customer_type:`VVIC`,factory:[],customer:null}),[n,i]=(0,u.useState)({month:null,factory:null,customer:null}),[a,o]=(0,u.useState)(null),[s,c]=(0,u.useState)([]),[l,d]=(0,u.useState)([]),[f,p]=(0,u.useState)([]),[m,_]=(0,u.useState)([]),[y,b]=(0,u.useState)([]),[x,S]=(0,u.useState)(!0),[C,w]=(0,u.useState)(``),[T,N]=(0,u.useState)(0),[P,F]=(0,u.useState)(!1),I=(0,u.useRef)(void 0),L=(0,u.useMemo)(()=>{let t={...e,factory:n.factory?[n.factory]:e.factory,customer:n.customer??e.customer};if(n.month){let[e,r]=n.month.split(`-`).map(Number);t.start_date=`${e}-${String(r).padStart(2,`0`)}-01`,t.end_date=new Date(Date.UTC(e,r,0)).toISOString().slice(0,10)}return t},[e,n]),R=(0,u.useMemo)(()=>{let t={...e,customer_type:`ALL`,factory:n.factory?[n.factory]:e.factory,customer:null};if(n.month){let[e,r]=n.month.split(`-`).map(Number);t.start_date=`${e}-${String(r).padStart(2,`0`)}-01`,t.end_date=new Date(Date.UTC(e,r,0)).toISOString().slice(0,10)}return t},[e,n.month,n.factory]),z=(0,u.useMemo)(()=>n.customer?e:L,[e,L,n.customer]);(0,u.useEffect)(()=>{I.current?.abort();let n=new AbortController;return I.current=n,S(!0),w(``),Promise.all([v(`/api/dashboard/summary`,L,n.signal),v(`/api/dashboard/monthly-comparison`,R,n.signal),v(`/api/dashboard/factory-monthly`,L,n.signal),v(`/api/dashboard/factory-product-breakdown`,L,n.signal),v(`/api/dashboard/customer-mtd`,z,n.signal,{target:`0.6`}),v(`/api/dashboard/customer-factory-mtd`,z,n.signal)]).then(([n,r,i,a,s,l])=>{o(n),!P&&n.data_as_of&&e.end_date>n.data_as_of?(F(!0),t(e=>({...e,start_date:M(n.data_as_of),end_date:n.data_as_of}))):P||F(!0),c(r),d(i),p(a),_(s),b(l)}).catch(e=>{e.name!==`AbortError`&&w(e.message)}).finally(()=>{n.signal.aborted||S(!1)}),()=>{n.abort()}},[e,L,R,z,T,P]);let B=e=>{i({month:null,factory:null,customer:null}),t(t=>({...t,factory:e===`ALL`?[]:[e]}))},V=e=>{i(t=>t.month===e?{month:null,factory:null,customer:null}:{month:e,factory:null,customer:null})},H=(e,t)=>{i(n=>n.month===e&&n.factory===t?{month:null,factory:null,customer:null}:{month:e,factory:t,customer:null})},U=e=>{i(t=>t.customer===e?{month:null,factory:null,customer:null}:{month:null,factory:null,customer:e})},W=(n.month?` · ${n.month}`:``)+(n.factory?` · ${n.factory}`:``)+(n.customer?` · ${n.customer}`:``);return(0,k.jsx)(`div`,{className:`\r
        min-h-screen\r
        bg-[#eaf1f8]\r
        text-ink\r
      `,children:(0,k.jsxs)(`main`,{className:`dashboard-main`,children:[(0,k.jsxs)(`header`,{children:[(0,k.jsx)(`div`,{children:(0,k.jsx)(`h1`,{children:`VVIC CUSTOMER`})}),(0,k.jsxs)(`label`,{children:[`CUSTOMER TYPE`,(0,k.jsxs)(`select`,{value:e.customer_type,onChange:e=>{i({month:null,factory:null,customer:null}),t(t=>({...t,customer_type:e.target.value}))},children:[(0,k.jsx)(`option`,{value:`VVIC`,children:`VVIC`}),(0,k.jsx)(`option`,{value:`NON-VVIC`,children:`NON-VVIC`})]})]}),(0,k.jsxs)(`label`,{children:[`START DATE`,(0,k.jsx)(`input`,{type:`date`,value:e.start_date,onChange:e=>{let n=e.target.value;i({month:null,factory:null,customer:null}),t(e=>({...e,start_date:n}))}})]}),(0,k.jsxs)(`label`,{children:[`END DATE`,(0,k.jsx)(`input`,{type:`date`,value:e.end_date,onChange:e=>{let n=e.target.value;i({month:null,factory:null,customer:null}),t(e=>({...e,end_date:n}))}})]}),(0,k.jsxs)(`div`,{className:`factories`,children:[(0,k.jsx)(`button`,{className:e.factory.length?``:`sel`,onClick:()=>B(`ALL`),children:`ALL`}),A.map(t=>(0,k.jsx)(`button`,{className:e.factory[0]===t?`sel`:``,onClick:()=>B(t),children:t},t))]}),(0,k.jsx)(`button`,{className:`refresh-data`,onClick:()=>N(e=>e+1),children:(0,k.jsx)(g,{size:16})})]}),(0,k.jsxs)(`div`,{className:`status`,children:[(0,k.jsx)(`span`,{className:`dot`}),(0,k.jsx)(`i`,{}),W,(n.month||n.factory||n.customer)&&(0,k.jsx)(`button`,{className:`clear-filter`,onClick:()=>i({month:null,factory:null,customer:null}),children:`CLEAR SELECTION`}),(0,k.jsxs)(`span`,{className:`refresh-time`,children:[`REFRESH:`,` `,a?new Date(a.last_refresh).toLocaleString(`th-TH`):`—`]})]}),C&&(0,k.jsxs)(`div`,{className:`error`,children:[(0,k.jsx)(`b`,{children:C}),(0,k.jsx)(`button`,{onClick:()=>N(e=>e+1),children:`ลองใหม่`})]}),(0,k.jsxs)(`section`,{className:`grid-layout`,children:[(0,k.jsxs)(`div`,{className:`left`,children:[(0,k.jsx)(`div`,{className:`kpis`,children:[[`YTD EFF%`,a?.ytd_eff_pct],[`QTD EFF%`,a?.qtd_eff_pct],[`MTD EFF%`,a?.mtd_eff_pct]].map(([e,t])=>(0,k.jsxs)(`article`,{className:`kpi`,children:[(0,k.jsx)(`em`,{}),(0,k.jsx)(`span`,{children:e}),(0,k.jsx)(`b`,{children:x?(0,k.jsx)(`span`,{className:`\r
                                  skeleton\r
                                  wide\r
                                `}):j(t)})]},e))}),(0,k.jsxs)(`article`,{className:`\r
                card\r
                trend\r
                clickable\r
              `,children:[(0,k.jsx)(`div`,{className:`card-title`,children:(0,k.jsxs)(`div`,{children:[(0,k.jsx)(`span`,{children:`PERFORMANCE TREND`}),(0,k.jsx)(`h2`,{children:`EFF% by Month — VVIC vs Non-VVIC`})]})}),x?(0,k.jsx)(`div`,{className:`\r
                        skeleton\r
                        chart\r
                      `}):(0,k.jsx)(r,{option:E(s,n.month),onEvents:{click:e=>{e?.name&&V(String(e.name))}},style:{height:420}})]})]}),(0,k.jsxs)(`div`,{className:`right`,children:[(0,k.jsxs)(`article`,{className:`\r
                card\r
                factory-card\r
                clickable\r
              `,children:[(0,k.jsx)(`div`,{className:`card-title`,children:(0,k.jsxs)(`div`,{children:[(0,k.jsx)(`span`,{children:`FACTORY VIEW`}),(0,k.jsx)(`h2`,{children:`Monthly EFF% by FACTORY and by VVIC`})]})}),x?(0,k.jsx)(`div`,{className:`\r
                        skeleton\r
                        chart\r
                      `}):(0,k.jsx)(r,{option:D(l,f,n.month?{month:n.month,factory:n.factory}:null),onEvents:{click:e=>{let t=e?.value?.[0]??e?.name,n=e?.seriesName;t&&n&&H(String(t),String(n))}},style:{height:265}})]}),(0,k.jsxs)(`article`,{className:`\r
                card\r
                customer-card\r
                clickable\r
                overflow-hidden\r
              `,children:[(0,k.jsxs)(`div`,{className:`card-title`,children:[(0,k.jsxs)(`div`,{children:[(0,k.jsx)(`span`,{children:`BRAND RANKING`}),(0,k.jsx)(`h2`,{children:`MTD EFF% by VVIC`})]}),(0,k.jsx)(`mark`,{children:`Target 60%`})]}),!x&&!m.length?(0,k.jsxs)(`div`,{className:`empty`,children:[(0,k.jsx)(h,{}),`ไม่พบข้อมูลในช่วงที่เลือก`]}):x?(0,k.jsx)(`div`,{className:`\r
                          skeleton\r
                          chart\r
                        `}):(0,k.jsx)(`div`,{style:{height:310,maxHeight:310,overflowY:`auto`,overflowX:`hidden`,position:`relative`,width:`100%`},children:(0,k.jsx)(r,{option:O(m,y,.6,n.customer),onEvents:{click:e=>{e?.name&&U(String(e.name))}},style:{height:Math.max(310,m.length*44),width:`100%`}})})]})]})]})]})})}export{N as default};