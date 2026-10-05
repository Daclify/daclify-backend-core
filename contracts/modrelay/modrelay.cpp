#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
using namespace eosio;
// Test fixture for core callback authority. Not a production module and not deployed
// by the release tooling. Production callers are the works, payroll, and decide contracts.
CONTRACT modrelay : public contract {
public:
  using contract::contract;
  ACTION reserve(name runtime,uint64_t dao_id,uint64_t source_id,uint64_t recipient,asset quantity,uint32_t due) {
    forward(runtime,"reserve"_n,pack(std::make_tuple(dao_id,get_self(),source_id,recipient,quantity,due)));
  }
  ACTION approveob(name runtime,uint64_t dao_id,uint64_t source_id) {
    forward(runtime,"approveob"_n,pack(std::make_tuple(dao_id,get_self(),source_id)));
  }
  ACTION cancelob(name runtime,uint64_t dao_id,uint64_t source_id) {
    forward(runtime,"cancelob"_n,pack(std::make_tuple(dao_id,get_self(),source_id)));
  }
  ACTION govlock(name runtime,uint64_t dao_id,uint64_t source_id,uint32_t expires) {
    forward(runtime,"govlock"_n,pack(std::make_tuple(dao_id,get_self(),source_id,expires)));
  }
  ACTION govunlock(name runtime,uint64_t dao_id,uint64_t source_id) {
    forward(runtime,"govunlock"_n,pack(std::make_tuple(dao_id,get_self(),source_id)));
  }
  ACTION impersonate(name runtime,name source,uint64_t dao_id,uint64_t source_id,uint64_t recipient,asset quantity,uint32_t due) {
    forward(runtime,"reserve"_n,pack(std::make_tuple(dao_id,source,source_id,recipient,quantity,due)));
  }
private:
  void forward(name runtime,name action_name,const std::vector<char>& bytes) {
    action outgoing;outgoing.account=runtime;outgoing.name=action_name;outgoing.authorization={{get_self(),"active"_n}};outgoing.data=bytes;outgoing.send();
  }
};
EOSIO_DISPATCH(modrelay,(reserve)(approveob)(cancelob)(govlock)(govunlock)(impersonate))
