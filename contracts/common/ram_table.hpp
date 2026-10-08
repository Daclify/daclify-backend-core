#pragma once
#include "resources.hpp"
#include <type_traits>
namespace daclify {
template<eosio::name::raw Table,typename Value>
class ram_singleton:public eosio::singleton<Table,Value>{
  using base=eosio::singleton<Table,Value>;
  eosio::name code;
public:
  ram_singleton(eosio::name account,uint64_t scope):base(account,scope),code(account){}
  void set(const Value& value,eosio::name payer){
    bool found=base::exists();eosio::check(payer==code||(!payer.value&&found),"RAM_FOREIGN_PAYER");uint64_t before=found?eosio::pack_size(base::get())+224:0;uint64_t after=eosio::pack_size(value)+224;base::set(value,payer);
    if(after!=before)observe_ram(code,0,code,eosio::name{Table},after>before?after-before:0,before>after?before-after:0);
  }
  Value get_or_create(eosio::name payer,const Value& value=Value{}){if(base::exists())return base::get();set(value,payer);return value;}
  void remove(){if(!base::exists())return;uint64_t bytes=eosio::pack_size(base::get())+224;base::remove();observe_ram(code,0,code,eosio::name{Table},0,bytes);}
};
template<typename T,typename=void>struct row_has_dao:std::false_type{};
template<typename T>struct row_has_dao<T,std::void_t<decltype(std::declval<T>().dao_id)>>:std::true_type{};
template<typename T,typename=void>struct row_has_ram_owner:std::false_type{};
template<typename T>struct row_has_ram_owner<T,std::void_t<decltype(std::declval<T>().ram_owner(eosio::name{},uint64_t{}))>>:std::true_type{};
template<eosio::name::raw Table,typename Row,typename... Indices>
class ram_table:public eosio::multi_index<Table,Row,Indices...>{
  using base=eosio::multi_index<Table,Row,Indices...>;
  static constexpr bool is_module=
#ifdef DACLIFY_MODULE_METERING
    true;
#else
    false;
#endif
  eosio::name runtime()const{return is_module?eosio::name{base::get_scope()}:base::get_code();}
  uint64_t owner(const Row& r)const{
    if constexpr(row_has_ram_owner<Row>::value)return r.ram_owner(base::get_code(),base::get_scope());
    else if constexpr(row_has_dao<Row>::value)return r.dao_id;
    else if constexpr(static_cast<uint64_t>(Table)=="daos"_n.value)return r.id;
    else if constexpr(!is_module)return scoped()?base::get_scope():0;
    else{eosio::check(false,"RAM_OWNER_UNKNOWN");return 0;}
  }
  bool scoped()const{
    if constexpr(is_module)return false;
    switch(static_cast<uint64_t>(Table)){case "members"_n.value:case "actors"_n.value:case "sessions"_n.value:case "evmbindings"_n.value:case "modules"_n.value:case "documents"_n.value:case "epochs"_n.value:case "keygrants"_n.value:case "govlocks"_n.value:case "obligations"_n.value:case "receipts"_n.value:return true;default:return false;}
  }
  void delta(uint64_t dao,uint64_t added,uint64_t removed){observe_ram(runtime(),dao,base::get_code(),eosio::name{Table},added,removed);}
  void header(uint64_t dao,uint64_t added,uint64_t removed){observe_ram(runtime(),scoped()?dao:0,base::get_code(),eosio::name{Table},added,removed);}
  template<typename Index>struct tracked_index:public Index{
    ram_table* parent;
    tracked_index(Index value,ram_table* table):Index(value),parent(table){}
    template<typename Updater>void modify(const Row& obj,eosio::name payer,Updater&& fn)const{parent->modify(obj,payer,std::forward<Updater>(fn));}
    template<typename Updater>void modify(typename Index::const_iterator it,eosio::name payer,Updater&& fn)const{modify(*it,payer,std::forward<Updater>(fn));}
    auto erase(typename Index::const_iterator it)const{auto next=it;++next;parent->erase(parent->find(it->primary_key()));return next;}
  };
public:
  using base::base;
  template<typename Constructor>auto emplace(eosio::name payer,Constructor&& fn){
    eosio::check(payer==base::get_code(),"RAM_FOREIGN_PAYER");bool empty=base::begin()==base::end();auto it=base::emplace(payer,std::forward<Constructor>(fn));auto dao=owner(*it);delta(dao,ram_row_bytes<Row,Indices...>(*it),0);if(empty)header(dao,ram_scope_bytes<Indices...>(),0);return it;
  }
  template<typename Updater>void modify(const Row& obj,eosio::name payer,Updater&& fn){
    eosio::check(!payer.value||payer==base::get_code(),"RAM_FOREIGN_PAYER");auto old_owner=owner(obj);auto before=ram_row_bytes<Row,Indices...>(obj);auto key=obj.primary_key();base::modify(obj,payer,std::forward<Updater>(fn));const auto& updated=base::get(key);auto next_owner=owner(updated);auto after=ram_row_bytes<Row,Indices...>(updated);
    if(old_owner!=next_owner){delta(old_owner,0,before);delta(next_owner,after,0);}else if(after>before)delta(old_owner,after-before,0);else if(before>after)delta(old_owner,0,before-after);
  }
  template<typename Updater>void modify(typename base::const_iterator it,eosio::name payer,Updater&& fn){modify(*it,payer,std::forward<Updater>(fn));}
  auto erase(typename base::const_iterator it){auto dao=owner(*it);auto bytes=ram_row_bytes<Row,Indices...>(*it);auto next=base::erase(it);delta(dao,0,bytes);if(base::begin()==base::end())header(dao,0,ram_scope_bytes<Indices...>());return next;}
  void erase(const Row& obj){erase(base::iterator_to(obj));}
  template<eosio::name::raw IndexName>auto get_index(){auto value=base::template get_index<IndexName>();return tracked_index<decltype(value)>{value,this};}
  template<eosio::name::raw IndexName>auto get_index()const{return base::template get_index<IndexName>();}
};
}
