from datetime import date, datetime

MONTHS=["2024-07","2024-08","2024-09","2024-10","2024-11","2024-12","2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01"]
VVIC=[.64,.652,.655,.65,.63,.62,.62,.59,.60,.58,.56,.58,.63,.64,.66,.62,.61,.67,.69]
NON=[.635,.74,.70,.645,.62,.60,.595,.59,.53,.525,.55,.58,.61,.612,.62,.575,.555,.60,.63]
FACTORY={"G1":[.521,.545,.621,.662],"G2":[.64,.691,.694,.681],"G3":[.689,.775,.741,.749],"G4":[.478,.455,.669,.419],"TRM":[.678,.731,.743,.749],"EA":[.698,.833,.84,.72]}
CUSTOMERS=[("JR286","G3",.94),("PETER MILLAR LLC","G1",.66),("HAKRO","G4",.65),("TRAVIS MATHEW","G2",.61),("LULULEMON","G2",.59),("FANATICS-BRANDS","G3",.55),("TOMMY BAHAMA","EA",.47)]
LAST_REFRESH=datetime.fromisoformat("2026-08-20T03:41:18+07:00")
FACTORY_FACTOR={"G1":.96,"G2":1.01,"G3":1.08,"G4":.93,"TRM":1.04,"EA":1.10}
PRODUCTS={"OTHER":.81,"JKT":.531,"POL":.522,"SHIRT":.513,"OVS":.487,"TROUSER":.462}

def _factor(selected): return FACTORY_FACTOR.get(selected[0],1) if selected else 1
def summary(filters):
    customer_factor=.97 if filters.get("customer") else 1
    data_as_of=min(date(2026,1,13),filters.get("end_date") or date(2026,1,13))
    selected_month=data_as_of.strftime('%Y-%m')
    month_factor=(VVIC[MONTHS.index(selected_month)]/.69) if selected_month in MONTHS else 1
    factor=_factor(filters.get("factories"))*customer_factor*month_factor
    return {"data_as_of":data_as_of,"last_refresh":LAST_REFRESH,"ytd_eff_pct":min(.99,.6852*factor),"qtd_eff_pct":min(.99,.6820*factor),"mtd_eff_pct":min(.99,.6900*factor),"active_filters":filters}
def monthly(selected,customer=None,start_date=None,end_date=None):
    factor=_factor(selected)*(.97 if customer else 1)
    start_month=start_date.strftime('%Y-%m') if start_date else MONTHS[0]
    end_month=end_date.strftime('%Y-%m') if end_date else MONTHS[-1]
    return [{"month":m,"vvic":min(.99,v*factor),"non_vvic":min(.99,n*factor)} for m,v,n in zip(MONTHS,VVIC,NON) if start_month<=m<=end_month]
def factory_monthly(selected,customer=None,start_date=None,end_date=None):
    months=["2025-10","2025-11","2025-12","2026-01"]
    factor=.97 if customer else 1
    start_month=start_date.strftime('%Y-%m') if start_date else months[0]
    end_month=end_date.strftime('%Y-%m') if end_date else months[-1]
    return [{"month":m,"factory":f,"eff_pct":v*factor} for f,vals in FACTORY.items() if not selected or f in selected for m,v in zip(months,vals) if start_month<=m<=end_month]
def factory_product_breakdown(selected,customer=None,start_date=None,end_date=None):
    months=["2025-10","2025-11","2025-12","2026-01"]
    start_month=start_date.strftime('%Y-%m') if start_date else months[0]
    end_month=end_date.strftime('%Y-%m') if end_date else months[-1]
    customer_factor=.97 if customer else 1
    result=[]
    for mi,m in enumerate(months):
        if not start_month<=m<=end_month: continue
        for fi,f in enumerate(FACTORY):
            if selected and f not in selected: continue
            for pi,(product,value) in enumerate(PRODUCTS.items()):
                adjusted=min(.99,max(.05,value+(mi-2)*.012+(fi-2)*.007-pi*.003))*customer_factor
                result.append({"month":m,"factory":f,"product_type":product,"eff_pct":adjusted})
    return result
def customer_mtd(target,selected,customer=None,end_date=None):
    selected_month=end_date.strftime('%Y-%m') if end_date else '2026-01'
    month_factor=(VVIC[MONTHS.index(selected_month)]/.69) if selected_month in MONTHS else 1
    factory_factor=_factor(selected)
    return [{"customer":c,"factory":f,"month":selected_month,"eff_pct":min(.99,v*month_factor*factory_factor),"target":target} for c,f,v in CUSTOMERS if (not selected or f in selected) and (not customer or c==customer)]
def customer_factory_mtd(selected,customer=None,end_date=None):
    selected_month=end_date.strftime('%Y-%m') if end_date else '2026-01'
    month_factor=(VVIC[MONTHS.index(selected_month)]/.69) if selected_month in MONTHS else 1
    rows=[]
    for ci,(brand,primary,base) in enumerate(CUSTOMERS):
        if customer and brand!=customer: continue
        for fi,factory in enumerate(FACTORY):
            if selected and factory not in selected: continue
            value=max(.05,min(.99,base*month_factor*(.72+fi*.055+ci*.009)))
            rows.append({"customer":brand,"factory":factory,"month":selected_month,"eff_pct":value})
    return rows
