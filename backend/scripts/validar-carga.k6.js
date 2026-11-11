import http from 'k6/http';
import {check,sleep} from 'k6';
import {Trend,Rate,Counter} from 'k6/metrics';
import exec from 'k6/execution';
const fases={constante:{n:new Counter('pulsepay_iteracoes_constante'),aceite:new Trend('pulsepay_aceite_constante_ms',true),confirmacao:new Trend('pulsepay_confirmacao_constante_ms',true)},pico:{n:new Counter('pulsepay_iteracoes_pico'),aceite:new Trend('pulsepay_aceite_pico_ms',true),confirmacao:new Trend('pulsepay_confirmacao_pico_ms',true)}};
const URL=__ENV.API_URL||'http://localhost:4000';
const aceite=new Rate('pulsepay_aceite'),sucesso=new Rate('pulsepay_sucesso'),confirmacao=new Trend('pulsepay_confirmacao_cliente_ms',true),pendentes=new Counter('pulsepay_pendentes'),falhasNegocio=new Counter('pulsepay_falhas_negocio');
export const options={setupTimeout:'180s',scenarios:{constante:{executor:'constant-arrival-rate',rate:40,timeUnit:'1s',duration:'1m',preAllocatedVUs:60,maxVUs:150,exec:'transferir'},pico:{executor:'constant-arrival-rate',rate:150,timeUnit:'1s',duration:'1m',startTime:'1m5s',preAllocatedVUs:150,maxVUs:250,exec:'transferir'}},thresholds:{'http_req_duration{operacao:aceite}':['p(95)<500'],pulsepay_confirmacao_cliente_ms:['p(95)<2000'],http_req_failed:['rate<0.0005'],pulsepay_aceite:['rate>0.9995'],pulsepay_sucesso:['rate>0.9995'],pulsepay_pendentes:['count==0'],pulsepay_falhas_negocio:['count==0'],dropped_iterations:['count==0']}};
export function setup(){
 const pairs=[],stamp=String(Date.now()).slice(-7);
 for(let i=0;i<20;i++){
  const pair={};for(const role of ['origem','destino']){
   const index=i*2+(role==='destino'?1:0),email=`carga-${stamp}-${index}@teste.pulsepay.local`,senha='TesteCarga123';
   const r=http.post(URL+'/auth/registrar',JSON.stringify({nome:`Carga ${role} ${i}`,email,cpf:'70'+stamp+String(index).padStart(2,'0'),senha}),{headers:{'Content-Type':'application/json'},tags:{operacao:'preparacao'}});
   if(r.status!==201)throw new Error('Cadastro de carga não concluído: '+r.status+' '+r.body);
   const l=http.post(URL+'/auth/login',JSON.stringify({email,senha}),{headers:{'Content-Type':'application/json'},tags:{operacao:'preparacao'}});
   if(l.status!==200)throw new Error('Login de carga não concluído');pair[role]={email,token:l.json('token')};
  }pairs.push(pair);
 }
 return {pairs};
}
export function transferir(data){
 fases[exec.scenario.name].n.add(1);
 const pair=data.pairs[Math.floor(Math.random()*data.pairs.length)],headers={'Content-Type':'application/json',Authorization:'Bearer '+pair.origem.token};
 const start=Date.now(),r=http.post(URL+'/transferencias',JSON.stringify({emailDestino:pair.destino.email,valor:1}),{headers,tags:{operacao:'aceite'}});
 const accepted=r.status===202;aceite.add(accepted);check(r,{'HTTP 202':()=>accepted});
 fases[exec.scenario.name].aceite.add(r.timings.duration);
 if(!accepted){sucesso.add(false);return}
 const id=r.json('id');let status='PENDENTE';
 for(let n=0;n<100&&status==='PENDENTE';n++){
  sleep(.1);const q=http.get(URL+'/transferencias/'+id,{headers,tags:{operacao:'consulta',name:'GET /transferencias/:id'}});if(q.status===200)status=q.json('status');
 }
 const done=status==='CONCLUIDO';sucesso.add(done);check(status,{'CONCLUIDO':()=>done});
 if(done){confirmacao.add(Date.now()-start);fases[exec.scenario.name].confirmacao.add(Date.now()-start)}if(status==='PENDENTE')pendentes.add(1);else pendentes.add(0);
 if(status==='FALHOU')falhasNegocio.add(1);else falhasNegocio.add(0);
}
export function handleSummary(data){const {setup_data,...report}=data;return {'../../evidencias/carga-resumo.json':JSON.stringify({...report,sanitization:{setup_data:'omitido por conter credenciais de teste; métricas preservadas'}},null,2),stdout:JSON.stringify({metrics:data.metrics,root_group:data.root_group},null,2)}}
