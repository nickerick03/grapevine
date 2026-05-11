-- Fix: ambiguous "cup_id" reference during manual cup finalization
-- Error seen from admin_finalize_cup -> finalize_cup_internal:
--   column reference "cup_id" is ambiguous (42702)

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cup_placements_unique_cup_placement'
      and conrelid = 'public.cup_placements'::regclass
  ) then
    alter table public.cup_placements
      add constraint cup_placements_unique_cup_placement unique (cup_id, placement);
  end if;
end;
$$;

create or replace function public.finalize_cup_internal(
  p_cup_id uuid,
  p_actor_user_id uuid default null
)
returns table (
  cup_id uuid,
  placements_saved integer,
  rewards_saved integer,
  already_finalized boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.cups%rowtype;
  v_saved_placements integer := 0;
  v_saved_rewards integer := 0;
  v_reward integer;
  v_row record;
begin
  select *
  into v_cup
  from public.cups c
  where c.id = p_cup_id
  for update;

  if not found then
    raise exception 'Cup not found';
  end if;

  if v_cup.finalized_at is not null then
    return query select v_cup.id, 0, 0, true;
    return;
  end if;

  for v_row in
    select
      r.user_id,
      r.rank,
      r.cup_score
    from public.get_cup_leaderboard(v_cup.id, 3) r
    where r.rank between 1 and 3
    order by r.rank asc
  loop
    v_reward := case
      when v_row.rank = 1 then round(v_cup.reward_points::numeric * 1.0)::int
      when v_row.rank = 2 then round(v_cup.reward_points::numeric * 0.5)::int
      when v_row.rank = 3 then round(v_cup.reward_points::numeric * 0.25)::int
      else 0
    end;

    insert into public.cup_placements (
      cup_id,
      user_id,
      placement,
      cup_score,
      reward_points_awarded,
      created_at
    )
    values (
      v_cup.id,
      v_row.user_id,
      v_row.rank,
      v_row.cup_score,
      greatest(v_reward, 0),
      now()
    )
    on conflict on constraint cup_placements_unique_cup_placement do nothing;

    if found then
      v_saved_placements := v_saved_placements + 1;
    end if;

    if v_reward > 0 then
      insert into public.score_transactions (
        user_id,
        cup_id,
        transaction_type,
        points,
        idempotency_key,
        metadata,
        created_at
      )
      values (
        v_row.user_id,
        v_cup.id,
        'cup_reward',
        v_reward,
        format('cup_reward:%s:placement:%s', v_cup.id::text, v_row.rank::text),
        jsonb_build_object(
          'placement', v_row.rank,
          'cup_name', v_cup.name,
          'reward_multiplier', case when v_row.rank = 1 then 1.0 when v_row.rank = 2 then 0.5 else 0.25 end,
          'source', 'cup_finalization'
        ),
        now()
      )
      on conflict (idempotency_key) do nothing;

      if found then
        v_saved_rewards := v_saved_rewards + 1;
      end if;
    end if;
  end loop;

  update public.cups
  set
    finalized_at = now(),
    finalized_by = coalesce(p_actor_user_id, finalized_by),
    is_active = false,
    updated_at = now()
  where id = v_cup.id;

  return query select v_cup.id, v_saved_placements, v_saved_rewards, false;
end;
$$;
