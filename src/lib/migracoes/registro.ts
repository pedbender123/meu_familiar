import type { Migracao } from './tipos';
import m001 from './001_base';
import m002 from './002_interruptores';
import m003 from './003_anomalias';
import m004 from './004_fila_capi';
import m005 from './005_nucleo_assinaturas';
import m006 from './006_contas_checkout';
import m007 from './007_plano_gratuito';
import m008 from './008_fila_oraculo';
import m009 from './009_planos_assinatura';
import m010 from './010_teto_diario_nos_planos_antigos';
import m011 from './011_dados_de_nascimento';
import m012 from './012_cortesia_para_quem_comprou';
import m013 from './013_hora_aproximada';
import m014 from './014_consumo';
import m015 from './015_cotas_de_leitura';
import m016 from './016_leituras';
import m017 from './017_revelacao_gratuita';
import m018 from './018_cobrancas';
import m019 from './019_planos_de_agosto';
import m020 from './020_acesso_gratis_depois';
import m021 from './021_equipe_do_painel';
import m022 from './022_avisos_enviados';
import m023 from './023_guias_semanais';
import m024 from './024_identidade_do_visitante';
import m025 from './025_melhoria_apos_entrega';
import m026 from './026_utms_no_pedido';
import m027 from './027_gateway_e_telefone';
import m028 from './028_precos_da_oferta';
import m029 from './029_gateway_da_campanha';

/**
 * A ordem de execução. Só se acrescenta ao fim — nunca reordena, nunca edita
 * uma migração já aplicada em produção. Uma migração errada se corrige com
 * uma migração nova que desfaz o efeito, não editando a antiga.
 */
export const MIGRACOES: Migracao[] = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m016, m017, m018, m019, m020, m021, m022, m023, m024, m025, m026, m027, m028, m029];
