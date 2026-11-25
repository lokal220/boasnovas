CREATE TABLE "agenda_fixa" (
	"id" serial PRIMARY KEY NOT NULL,
	"unidade_id" text NOT NULL,
	"dia_semana" integer NOT NULL,
	"hora" text NOT NULL,
	"turno" text NOT NULL,
	"rotulo" text DEFAULT '' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultos" (
	"id" text PRIMARY KEY NOT NULL,
	"unidade_id" text NOT NULL,
	"data" date NOT NULL,
	"hora" text DEFAULT '' NOT NULL,
	"turno" text NOT NULL,
	"titulo" text DEFAULT '' NOT NULL,
	"extra" boolean DEFAULT false NOT NULL,
	"nota" text DEFAULT '' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalas" (
	"id" text PRIMARY KEY NOT NULL,
	"culto_id" text NOT NULL,
	"ministerio_id" text NOT NULL,
	"membro_id" text NOT NULL,
	"papel" text DEFAULT 'servo' NOT NULL,
	"funcao" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'confirmado' NOT NULL,
	"origem" text DEFAULT 'lider' NOT NULL,
	"checkin_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membros" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"apelidos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"telefone" text DEFAULT '' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"token_acesso" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membros_token_acesso_unique" UNIQUE("token_acesso")
);
--> statement-breakpoint
CREATE TABLE "ministerio_membros" (
	"ministerio_id" text NOT NULL,
	"membro_id" text NOT NULL,
	"papel" text DEFAULT 'servo' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ministerio_membros_ministerio_id_membro_id_pk" PRIMARY KEY("ministerio_id","membro_id")
);
--> statement-breakpoint
CREATE TABLE "ministerios" (
	"id" text PRIMARY KEY NOT NULL,
	"unidade_id" text NOT NULL,
	"nome" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"icone" text DEFAULT 'maos' NOT NULL,
	"vagas_padrao" integer DEFAULT 3 NOT NULL,
	"acesso" text DEFAULT 'aberto' NOT NULL,
	"token_publico" text NOT NULL,
	"horarios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"aviso" text DEFAULT '' NOT NULL,
	"whatsapp_lider" text DEFAULT '' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ministerios_token_publico_unique" UNIQUE("token_publico")
);
--> statement-breakpoint
CREATE TABLE "registros" (
	"id" serial PRIMARY KEY NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	"ator" text NOT NULL,
	"acao" text NOT NULL,
	"alvo" text DEFAULT '' NOT NULL,
	"dados" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trocas" (
	"id" text PRIMARY KEY NOT NULL,
	"escala_id" text NOT NULL,
	"solicitante_id" text NOT NULL,
	"substituto_id" text,
	"status" text DEFAULT 'aberta' NOT NULL,
	"mensagem" text DEFAULT '' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvido_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unidades" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"endereco" text DEFAULT '' NOT NULL,
	"fuso_horario" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"login" text NOT NULL,
	"senha_hash" text NOT NULL,
	"papel" text DEFAULT 'lider' NOT NULL,
	"ministerios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"membro_id" text,
	"deve_trocar_senha" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_acesso_em" timestamp with time zone,
	CONSTRAINT "usuarios_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "vagas" (
	"culto_id" text NOT NULL,
	"ministerio_id" text NOT NULL,
	"quantidade" integer NOT NULL,
	CONSTRAINT "vagas_culto_id_ministerio_id_pk" PRIMARY KEY("culto_id","ministerio_id")
);
--> statement-breakpoint
ALTER TABLE "agenda_fixa" ADD CONSTRAINT "agenda_fixa_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultos" ADD CONSTRAINT "cultos_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_culto_id_cultos_id_fk" FOREIGN KEY ("culto_id") REFERENCES "public"."cultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_membro_id_membros_id_fk" FOREIGN KEY ("membro_id") REFERENCES "public"."membros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministerio_membros" ADD CONSTRAINT "ministerio_membros_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministerio_membros" ADD CONSTRAINT "ministerio_membros_membro_id_membros_id_fk" FOREIGN KEY ("membro_id") REFERENCES "public"."membros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministerios" ADD CONSTRAINT "ministerios_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas" ADD CONSTRAINT "trocas_escala_id_escalas_id_fk" FOREIGN KEY ("escala_id") REFERENCES "public"."escalas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas" ADD CONSTRAINT "trocas_solicitante_id_membros_id_fk" FOREIGN KEY ("solicitante_id") REFERENCES "public"."membros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas" ADD CONSTRAINT "trocas_substituto_id_membros_id_fk" FOREIGN KEY ("substituto_id") REFERENCES "public"."membros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_membro_id_membros_id_fk" FOREIGN KEY ("membro_id") REFERENCES "public"."membros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_culto_id_cultos_id_fk" FOREIGN KEY ("culto_id") REFERENCES "public"."cultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cultos_data_idx" ON "cultos" USING btree ("data");--> statement-breakpoint
CREATE UNIQUE INDEX "escalas_unica_idx" ON "escalas" USING btree ("culto_id","ministerio_id","membro_id");--> statement-breakpoint
CREATE INDEX "escalas_membro_idx" ON "escalas" USING btree ("membro_id");--> statement-breakpoint
CREATE INDEX "registros_quando_idx" ON "registros" USING btree ("quando");--> statement-breakpoint
CREATE INDEX "trocas_status_idx" ON "trocas" USING btree ("status");